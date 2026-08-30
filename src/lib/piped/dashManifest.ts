import type { PipedStreamsResponse, PipedStream } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isAvc(codec: string | null, mimeType: string): boolean {
  const c = (codec ?? "").toLowerCase();
  const m = mimeType.toLowerCase();
  return c.includes("avc1") || c.includes("avc.") || m.includes("avc1");
}

function isMp4a(codec: string | null, mimeType: string): boolean {
  const c = (codec ?? "").toLowerCase();
  const m = mimeType.toLowerCase();
  return c.includes("mp4a") || m.includes("mp4a");
}

function estimateBandwidth(height: number | null, bitrate: number | null): number {
  if (bitrate != null && Number.isFinite(bitrate) && bitrate > 1000) return Math.round(bitrate);
  if (bitrate != null && Number.isFinite(bitrate) && bitrate > 0 && bitrate < 1000) return Math.round(bitrate * 1000);
  if (height == null) return 1_200_000;
  if (height <= 144) return 300_000;
  if (height <= 240) return 500_000;
  if (height <= 360) return 800_000;
  if (height <= 480) return 1_000_000;
  if (height <= 720) return 2_500_000;
  if (height <= 1080) return 5_000_000;
  return 8_000_000;
}

function toIsoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "PT0S";
  const s = Math.round(seconds * 1000) / 1000;
  if (Number.isInteger(s)) return `PT${s}S`;
  return `PT${s.toFixed(3).replace(/\.?0+$/, "")}S`;
}

function mimeWithoutCodecs(mimeType: string): string {
  const idx = mimeType.indexOf(";");
  if (idx === -1) return mimeType.trim();
  return mimeType.slice(0, idx).trim();
}

function codecFromStream(s: PipedStream): string | null {
  if (s.codec && s.codec.trim()) return s.codec.trim();
  const m = s.mimeType;
  const match = /codecs="([^"]+)"/i.exec(m);
  if (match) return match[1].trim();
  const match2 = /codecs=([^;,\s]+)/i.exec(m);
  if (match2) return match2[1].replace(/^"|"$/g, "").trim();
  return null;
}

export function buildPipedDashManifest(streams: PipedStreamsResponse, maxHeight = 1080): string {
  if (!streams || !Number.isFinite(streams.duration) || streams.duration <= 0) {
    throw new Error("invalid_duration");
  }

  const rawVideos = streams.videoStreams ?? [];
  const rawAudios = streams.audioStreams ?? [];

  const filteredVideos = rawVideos.filter((s) => {
    if (!isHttpsUrl(s.url)) return false;
    if (s.height == null || s.width == null) return false;
    if (!Number.isFinite(s.height) || !Number.isFinite(s.width)) return false;
    if (s.height <= 0 || s.width <= 0) return false;
    if (s.height > maxHeight) return false;
    const mt = s.mimeType.toLowerCase();
    if (!mt.includes("video")) return false;
    // init/index required for DASH on-demand, but progressive Invidious fallback may not have them — allow if missing
    if (s.initStart != null && s.initEnd != null && s.indexStart != null && s.indexEnd != null) {
      if (s.initStart < 0 || s.initEnd < s.initStart) return false;
      if (s.indexStart < 0 || s.indexEnd < s.indexStart) return false;
    }
    return true;
  });

  if (!filteredVideos.length) {
    throw new Error("no_valid_video_streams");
  }

  const byHeight = new Map<number, PipedStream[]>();
  for (const s of filteredVideos) {
    const h = s.height as number;
    const list = byHeight.get(h) ?? [];
    list.push(s);
    byHeight.set(h, list);
  }

  const dedupedVideos: PipedStream[] = [];
  for (const [, group] of byHeight) {
    group.sort((a, b) => {
      const aAvc = isAvc(a.codec, a.mimeType) ? 0 : 1;
      const bAvc = isAvc(b.codec, b.mimeType) ? 0 : 1;
      if (aAvc !== bAvc) return aAvc - bAvc;
      const aBw = estimateBandwidth(a.height, a.bitrate);
      const bBw = estimateBandwidth(b.height, b.bitrate);
      return bBw - aBw;
    });
    dedupedVideos.push(group[0]);
  }

  dedupedVideos.sort((a, b) => (a.height as number) - (b.height as number));

  const audioCandidates = rawAudios.filter((s) => {
    if (!isHttpsUrl(s.url)) return false;
    if (s.videoOnly) return false;
    const mt = s.mimeType.toLowerCase();
    if (!mt.includes("audio")) return false;
    if (s.initStart != null && s.initEnd != null && s.indexStart != null && s.indexEnd != null) {
      if (s.initStart < 0 || s.initEnd < s.initStart) return false;
      if (s.indexStart < 0 || s.indexEnd < s.indexStart) return false;
    }
    return true;
  });

  let filteredAudios: PipedStream[] = [];
  if (audioCandidates.length) {
    const mp4a = audioCandidates.filter((s) => isMp4a(s.codec, s.mimeType));
    const pool = mp4a.length ? mp4a : audioCandidates;
    pool.sort((a, b) => estimateBandwidth(null, b.bitrate) - estimateBandwidth(null, a.bitrate));
    filteredAudios = pool.slice(0, 1);
  }

  if (!filteredAudios.length) {
    throw new Error("no_valid_audio_streams");
  }

  const durationIso = toIsoDuration(streams.duration);
  const maxWidth = Math.max(...dedupedVideos.map((s) => s.width as number));
  const maxH = Math.max(...dedupedVideos.map((s) => s.height as number));

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="${escapeXml(durationIso)}" minBufferTime="PT1.5S" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd">`
  );
  lines.push(`  <Period duration="${escapeXml(durationIso)}">`);

  lines.push(
    `    <AdaptationSet id="0" mimeType="video/mp4" segmentAlignment="true" startWithSAP="1" maxWidth="${maxWidth}" maxHeight="${maxH}">`
  );
  for (let i = 0; i < dedupedVideos.length; i++) {
    const s = dedupedVideos[i];
    const codecs = codecFromStream(s) ?? "avc1.4d401f";
    const bw = estimateBandwidth(s.height, s.bitrate);
    const w = s.width as number;
    const h = s.height as number;
    const baseMt = mimeWithoutCodecs(s.mimeType) || "video/mp4";
    const urlEsc = escapeXml(s.url);
    lines.push(
      `      <Representation id="v${i}" bandwidth="${bw}" width="${w}" height="${h}" codecs="${escapeXml(codecs)}" mimeType="${escapeXml(baseMt)}">`
    );
    lines.push(`        <BaseURL>${urlEsc}</BaseURL>`);
    if (s.initStart != null && s.initEnd != null && s.indexStart != null && s.indexEnd != null) {
      const initRange = `${s.initStart}-${s.initEnd}`;
      const indexRange = `${s.indexStart}-${s.indexEnd}`;
      lines.push(`        <SegmentBase indexRange="${escapeXml(indexRange)}"><Initialization range="${escapeXml(initRange)}" /></SegmentBase>`);
    }
    lines.push(`      </Representation>`);
  }
  lines.push(`    </AdaptationSet>`);

  for (let i = 0; i < filteredAudios.length; i++) {
    const s = filteredAudios[i];
    const codecs = codecFromStream(s) ?? "mp4a.40.2";
    const bw = estimateBandwidth(null, s.bitrate);
    const baseMt = mimeWithoutCodecs(s.mimeType) || "audio/mp4";
    const urlEsc = escapeXml(s.url);
    lines.push(`    <AdaptationSet id="1" mimeType="audio/mp4" lang="en" segmentAlignment="true" startWithSAP="1">`);
    lines.push(
      `      <Representation id="a${i}" bandwidth="${bw}" audioSamplingRate="48000" codecs="${escapeXml(codecs)}" mimeType="${escapeXml(baseMt)}">`
    );
    lines.push(`        <BaseURL>${urlEsc}</BaseURL>`);
    if (s.initStart != null && s.initEnd != null && s.indexStart != null && s.indexEnd != null) {
      const initRange = `${s.initStart}-${s.initEnd}`;
      const indexRange = `${s.indexStart}-${s.indexEnd}`;
      lines.push(`        <SegmentBase indexRange="${escapeXml(indexRange)}"><Initialization range="${escapeXml(initRange)}" /></SegmentBase>`);
    }
    lines.push(`      </Representation>`);
    lines.push(`    </AdaptationSet>`);
  }

  lines.push(`  </Period>`);
  lines.push(`</MPD>`);
  return lines.join("\n");
}
