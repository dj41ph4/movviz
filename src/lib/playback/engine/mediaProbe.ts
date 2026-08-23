/**
 * Phase 2 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md §7).
 * Runs ffprobe against one local file and maps its output to a
 * `MediaDescriptor`. This module never caches — that's `mediaProbeCache.ts`'s
 * job (plan §8-9: "never run ffprobe on every playback, only at import or
 * when the file changed").
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { AudioTrack, HdrType, MediaDescriptor, SubtitleTrack, SubtitleTrackType } from "./mediaDescriptor";

// Mirrors ffmpegBin()/isFfmpegAvailable() in ../ffmpeg/remuxSession.ts —
// same env var naming convention, same spawn/timeout/memoization shape.
function ffprobeBin(): string {
  return process.env.MOVVIZ_FFPROBE_PATH?.trim() || "ffprobe";
}

let cachedVersion: string | null | undefined; // undefined = not yet checked, null = checked and unavailable

/** ffprobe's own version string (e.g. "6.1.1"), or null if unavailable —
 *  memoized for the life of the server process, same tradeoff as
 *  isFfmpegAvailable(). Also serves as the availability check: no separate
 *  spawn is needed just to answer "is ffprobe there". */
export async function getFfprobeVersion(): Promise<string | null> {
  if (cachedVersion !== undefined) return cachedVersion;
  const bin = ffprobeBin();
  cachedVersion = await new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    let p: ChildProcess;
    try {
      p = spawn(bin, ["-version"], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      settle(null);
      return;
    }
    let out = "";
    p.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf-8"); });
    const t = setTimeout(() => {
      try { p.kill(); } catch { /* already dead */ }
      settle(null);
    }, 3000);
    p.on("error", () => { clearTimeout(t); settle(null); });
    p.on("exit", (code) => {
      clearTimeout(t);
      if (code !== 0) { settle(null); return; }
      const m = /ffprobe version (\S+)/.exec(out);
      settle(m?.[1] ?? "unknown");
    });
  });
  if (!cachedVersion) console.error(`[media-probe] ffprobe indisponible (bin="${bin}")`);
  return cachedVersion;
}

export async function isFfprobeAvailable(): Promise<boolean> {
  return (await getFfprobeVersion()) !== null;
}

interface FfprobeDisposition {
  default?: number;
  forced?: number;
}

interface FfprobeSideData {
  side_data_type?: string;
  dv_profile?: number;
}

interface FfprobeStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  level?: number | string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  bit_rate?: string;
  bits_per_raw_sample?: string;
  pix_fmt?: string;
  color_transfer?: string;
  channels?: number;
  sample_rate?: string;
  tags?: { language?: string; title?: string };
  disposition?: FfprobeDisposition;
  side_data_list?: FfprobeSideData[];
}

interface FfprobeFormat {
  format_name?: string;
  size?: string;
  duration?: string;
  bit_rate?: string;
}

interface FfprobeOutput {
  format: FfprobeFormat;
  streams: FfprobeStream[];
}

const PROBE_TIMEOUT_MS = 15_000;

function runFfprobe(filePath: string): Promise<FfprobeOutput> {
  return new Promise((resolve, reject) => {
    const bin = ffprobeBin();
    let p: ChildProcess;
    try {
      // -show_streams / -show_format give every field mediaDescriptor.ts
      // needs in one call — no per-stream follow-up probes.
      p = spawn(bin, ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const chunks: Buffer[] = [];
    let stderr = "";
    p.stdout?.on("data", (c: Buffer) => chunks.push(c));
    p.stderr?.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });
    const t = setTimeout(() => {
      try { p.kill(); } catch { /* already dead */ }
      reject(new Error(`ffprobe timed out after ${PROBE_TIMEOUT_MS}ms`));
    }, PROBE_TIMEOUT_MS);
    p.on("error", (err) => { clearTimeout(t); reject(err); });
    p.on("exit", (code) => {
      clearTimeout(t);
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as FfprobeOutput);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

// PGS/VobSub/DVB are burned/rendered image subtitles — everything else
// ffprobe reports for a subtitle stream is text-based (SRT/ASS/SSA/WebVTT/
// MOV text...). See mediaDescriptor.ts's SubtitleTrackType doc comment.
const IMAGE_SUBTITLE_CODECS = new Set(["hdmv_pgs_subtitle", "pgssub", "dvd_subtitle", "dvdsub", "dvb_subtitle"]);
function subtitleType(codecName: string): SubtitleTrackType {
  return IMAGE_SUBTITLE_CODECS.has(codecName) ? "image" : "text";
}

function parseFrameRate(rate?: string): number | undefined {
  if (!rate) return undefined;
  const [num, den] = rate.split("/").map(Number);
  if (!den) return Number.isFinite(num) && num > 0 ? num : undefined;
  return den > 0 ? num / den : undefined;
}

function parseNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function detectBitDepth(stream: FfprobeStream): number | undefined {
  const raw = parseNumber(stream.bits_per_raw_sample);
  if (raw) return raw;
  // pix_fmt encodes depth as a trailing number, e.g. "yuv420p10le" → 10,
  // plain "yuv420p" → implicitly 8-bit.
  const m = /p(\d+)(?:le|be)?$/.exec(stream.pix_fmt ?? "");
  if (m) return Number(m[1]);
  return stream.pix_fmt ? 8 : undefined;
}

function detectHdr(stream: FfprobeStream): MediaDescriptor["video"]["hdr"] {
  const dovi = stream.side_data_list?.find((s) => s.side_data_type === "DOVI configuration record");
  if (dovi) {
    return { type: "dolby-vision" as HdrType, dolbyVisionProfile: dovi.dv_profile };
  }
  // smpte2084 = PQ transfer function (HDR10/HDR10+ — ffprobe doesn't
  // distinguish the "+" without a separate side-data check we don't need
  // yet), arib-std-b67 = HLG. Anything else (bt709, unknown...) is SDR —
  // deliberately left undefined rather than an explicit {type:"sdr"}, since
  // "no hdr field" already means SDR at the type level (mediaDescriptor.ts).
  if (stream.color_transfer === "smpte2084") return { type: "hdr10" as HdrType };
  if (stream.color_transfer === "arib-std-b67") return { type: "hlg" as HdrType };
  return undefined;
}

/**
 * Probes one local file and returns its `MediaDescriptor`. Throws on any
 * ffprobe failure (missing binary, corrupt file, timeout) — callers decide
 * whether that's fatal or worth falling back for; this function never
 * swallows an error into a partial/guessed result.
 */
export async function probeMediaFile(mediaId: string, filePath: string): Promise<MediaDescriptor> {
  const raw = await runFfprobe(filePath);
  const videoStream = raw.streams.find((s) => s.codec_type === "video");
  if (!videoStream) throw new Error(`No video stream found in ${filePath}`);

  const audioTracks: AudioTrack[] = raw.streams
    .filter((s) => s.codec_type === "audio")
    .map((s): AudioTrack => ({
      index: s.index,
      codec: s.codec_name ?? "unknown",
      language: s.tags?.language,
      title: s.tags?.title,
      channels: s.channels,
      bitrate: parseNumber(s.bit_rate),
      sampleRate: parseNumber(s.sample_rate),
      default: s.disposition?.default === 1,
      forced: s.disposition?.forced === 1,
    }));

  const subtitleTracks: SubtitleTrack[] = raw.streams
    .filter((s) => s.codec_type === "subtitle")
    .map((s): SubtitleTrack => ({
      index: s.index,
      codec: s.codec_name ?? "unknown",
      language: s.tags?.language,
      title: s.tags?.title,
      default: s.disposition?.default === 1,
      forced: s.disposition?.forced === 1,
      type: subtitleType(s.codec_name ?? ""),
    }));

  return {
    mediaId,
    source: { type: "local" },
    container: raw.format.format_name ?? "unknown",
    size: parseNumber(raw.format.size),
    durationMs: raw.format.duration ? Math.round(Number(raw.format.duration) * 1000) : undefined,
    bitrate: parseNumber(raw.format.bit_rate),
    video: {
      index: videoStream.index,
      codec: videoStream.codec_name ?? "unknown",
      profile: videoStream.profile,
      level: videoStream.level != null ? String(videoStream.level) : undefined,
      width: videoStream.width,
      height: videoStream.height,
      fps: parseFrameRate(videoStream.r_frame_rate),
      bitDepth: detectBitDepth(videoStream),
      bitrate: parseNumber(videoStream.bit_rate),
      hdr: detectHdr(videoStream),
    },
    audioTracks,
    subtitleTracks,
  };
}
