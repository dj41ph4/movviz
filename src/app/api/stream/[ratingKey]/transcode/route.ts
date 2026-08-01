import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";
import { registerSession } from "@/lib/player/transcodeSessions";
import { logTranscode } from "@/lib/player/transcodeLogs";
import {
  PLEX_UNIVERSAL_BASE,
  plexClientHeaders,
  rewriteM3u8,
} from "@/lib/player/plexStream";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

const DEFAULT_MAX_BITRATE = 8000;
const TRANSCODE_CACHE_TTL = 5; // master playlists must stay short-lived

function corsOrigin(req: NextRequest): string {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch { /* fallthrough */ }
  }
  return req.headers.get("origin") || "null";
}

function resolveClientMaxWidth(req: NextRequest): number {
  const qWidth = Number(req.nextUrl.searchParams.get("maxWidth"));
  if (qWidth > 0 && Number.isFinite(qWidth)) return qWidth;
  const hint = req.headers.get("x-movviz-client-width");
  if (hint) {
    const w = Number(hint);
    if (w > 0 && Number.isFinite(w)) return w;
  }
  return 1920;
}

function selectBitrate(sourceHeight: number, clientWidth: number): number {
  let cap = DEFAULT_MAX_BITRATE;
  if (sourceHeight >= 2000) cap = 15000;
  else if (sourceHeight >= 1440) cap = 10000;
  else if (sourceHeight >= 1000) cap = 8000;
  else if (sourceHeight >= 700) cap = 4000;
  else cap = 2000;

  if (clientWidth < 1920) {
    if (clientWidth <= 720) cap = Math.min(cap, 1500);
    else if (clientWidth <= 1080) cap = Math.min(cap, 3000);
    else if (clientWidth <= 1440) cap = Math.min(cap, 6000);
  }

  return cap;
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });

  if (!registerSession(user.id, ratingKey)) {
    logTranscode(ratingKey, "session", "Too many concurrent transcode sessions", 429);
    return NextResponse.json({ error: "too_many_transcode_sessions" }, { status: 429 });
  }

  const token = cfg.adminToken;
  const clientId = `movviz-${user.id}`;
  const sessionId = `movviz-${user.id}-${ratingKey}`;
  const headers = plexClientHeaders(token, clientId);

  const metadataUrl = `${base}/library/metadata/${ratingKey}`;
  const metaRes = await fetch(metadataUrl, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => "");
    logTranscode(ratingKey, "meta-fetch", `HTTP ${metaRes.status}: ${body.slice(0, 200)}`, metaRes.status);
    return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 502 });
  }

  const data = await metaRes.json();
  const metadata = data?.MediaContainer?.Metadata?.[0];
  if (!metadata) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const media = metadata?.Media?.[0];
  const height = Number(media?.videoResolution ?? media?.height ?? 0);
  const sp = req.nextUrl.searchParams;
  const audioStreamID = sp.get("audioStreamID");
  const subtitleStreamID = sp.get("subtitleStreamID");
  let videoCodec = (media?.videoCodec as string)?.toLowerCase() ?? "";
  let audioCodec = (media?.audioCodec as string)?.toLowerCase() ?? "";
  // The default audioCodec is the FIRST track's codec — but audioStreamID may
  // target a different track (e.g. DTS default + AC3 second track, the common
  // Remux case). The copy decision must use the codec of the track that will
  // actually play, otherwise Plex transcodes it needlessly.
  if (audioStreamID) {
    const streams: Array<{ id?: number; streamType?: number; codec?: string }> =
      media?.Part?.[0]?.Stream ?? [];
    const target = streams.find(
      (s) => s.streamType === 2 && String(s.id) === String(audioStreamID)
    );
    if (target?.codec) audioCodec = target.codec.toLowerCase();
  }
  logTranscode(ratingKey, "meta", `container=${media?.container ?? "?"} video=${videoCodec} audio=${audioCodec}${audioStreamID ? ` (piste ${audioStreamID})` : ""} res=${height}p`, "ok");

  // Smart transcode: only re-encode what the browser can't play natively.
  // tv=0 → bitstream-copy video (direct stream), tv=1 (default) → re-encode to h264.
  // ta=0 → bitstream-copy audio (direct stream), ta=1 (default) → re-encode to aac.
  // "copy" is accepted by Plex universal API as a passthrough hint.
  // Copy whitelist: Plex silently transcodes anything outside it (opus, flac,
  // vorbis, truehd...) — and browsers/hls.js can't handle E-AC3/DTS/TrueHD in
  // TS anyway, so we never request copy for them. hls.js only transmuxes
  // AAC / MP3 / AC-3 from MPEG-TS (E-AC3 = parsing error → silent video).
  const tv = sp.get("tv"); // "0" = copy, missing/"1" = transcode
  const ta = sp.get("ta");
  const COPY_SAFE_AUDIO = ["aac", "mp4a", "ac3", "ac-3", "mp3"];
  const COPY_SAFE_VIDEO = ["h264", "h.264", "hevc", "h265", "av1", "vp9"];
  // "eac3" contains "ac3" — exclude it explicitly, hls.js cannot demux E-AC3 from TS
  const copyAudioSafe =
    !audioCodec.includes("eac3") &&
    audioCodec !== "ec-3" &&
    COPY_SAFE_AUDIO.some((c) => audioCodec.includes(c));
  const copyVideoSafe = COPY_SAFE_VIDEO.some((c) => videoCodec.includes(c));
  const transcodeVideoCodec = tv === "0" && copyVideoSafe ? "copy" : "h264";
  const transcodeAudioCodec = ta === "0" && copyAudioSafe ? "copy" : "aac";

  const clientWidth = resolveClientMaxWidth(req);
  const qMaxBitrate = Number(sp.get("maxVideoBitrate"));
  const maxVideoBitrate = qMaxBitrate > 0 && Number.isFinite(qMaxBitrate)
    ? qMaxBitrate
    : selectBitrate(height, clientWidth);

  // directPlay=0 forces HLS packaging (required for hls.js).
  // directStream=1 allows bitstream copy when codecs already match the target.
  const qs = new URLSearchParams({
    path: `/library/metadata/${ratingKey}`,
    mediaIndex: "0",
    partIndex: "0",
    protocol: "hls",
    videoCodec: transcodeVideoCodec,
    audioCodec: transcodeAudioCodec,
    fastSeek: "1",
    directPlay: "0",
    directStream: "1",
    subtitleSize: "100",
    session: sessionId,
    "X-Plex-Platform": "Chrome",
    "X-Plex-Client-Identifier": clientId,
    "X-Plex-Product": "Movviz",
    "X-Plex-Device": "Web",
  });
  // Only set bitrate when video is actually being transcoded (not copied)
  if (transcodeVideoCodec !== "copy") {
    qs.set("maxVideoBitrate", String(maxVideoBitrate));
  }
  if (audioStreamID) qs.set("audioStreamID", audioStreamID);
  if (subtitleStreamID) qs.set("subtitleStreamID", subtitleStreamID);

  const transcodeUrl = `${base}${PLEX_UNIVERSAL_BASE}/start.m3u8?${qs.toString()}`;

  try {
    const brLog = transcodeVideoCodec !== "copy" ? ` br=${maxVideoBitrate}k` : "";
    console.log(`[transcode] ${ratingKey} → start.m3u8 tv=${tv} ta=${ta} v=${transcodeVideoCodec} a=${transcodeAudioCodec}${brLog}`);
    logTranscode(ratingKey, "plex-fetch", `tv=${tv} ta=${ta} codecs: v=${transcodeVideoCodec} a=${transcodeAudioCodec}${brLog}`, "ok");
    const m3u8Res = await fetch(transcodeUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!m3u8Res.ok) {
      const body = await m3u8Res.text().catch(() => "");
      logTranscode(ratingKey, "plex-response", `HTTP ${m3u8Res.status}: ${body.slice(0, 200)}`, m3u8Res.status);
      console.error(`[transcode] ${ratingKey} FAIL ${m3u8Res.status}: ${body.slice(0, 300)}`);
      console.error(`[transcode] ${ratingKey} codecs → video:${videoCodec} audio:${audioCodec}`);
      return NextResponse.json({ error: "transcode_start_failed", status: m3u8Res.status }, { status: 502 });
    }

    const raw = await m3u8Res.text();
    if (!raw.includes("#EXTM3U")) {
      logTranscode(ratingKey, "m3u8", `invalid body: ${raw.slice(0, 120)}`, 502);
      console.error(`[transcode] ${ratingKey} not an m3u8: ${raw.slice(0, 200)}`);
      return NextResponse.json({ error: "transcode_invalid_playlist" }, { status: 502 });
    }

    // Master playlist lives at .../universal/start.m3u8 — relative session/ URIs
    // resolve against .../universal/
    const masterPath = `${PLEX_UNIVERSAL_BASE}/start.m3u8`;
    const rewritten = rewriteM3u8(raw, masterPath);
    logTranscode(ratingKey, "m3u8", `ok — ${raw.split("\n").length} lines, rewritten`, "ok");
    console.log(`[transcode] ${ratingKey} master rewritten:\n${rewritten.slice(0, 300)}`);

    const cacheTtl = getStreamCacheTtl();
    // Master must not be cached long — session paths are per-playback
    const maxAge = Math.min(cacheTtl > 0 ? cacheTtl : TRANSCODE_CACHE_TTL, TRANSCODE_CACHE_TTL);

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": `private, max-age=${maxAge}`,
        "access-control-allow-origin": corsOrigin(req),
        "access-control-allow-credentials": "true",
      },
    });
  } catch (e) {
    console.error("[transcode] error", ratingKey, e);
    logTranscode(ratingKey, "error", e instanceof Error ? e.message : String(e), 500);
    return NextResponse.json({ error: "transcode_error" }, { status: 500 });
  }
}
