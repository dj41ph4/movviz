/**
 * Phase 6 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §18-19). Populates the `ServerPlaybackCapabilities` contract (Phase 1) by
 * actually running `ffmpeg -encoders`/`-decoders`/`-hwaccels` and parsing
 * their real output — never assumed from the platform. Memoized for the
 * server process lifetime, same tradeoff as isFfmpegAvailable() in
 * ../ffmpeg/remuxSession.ts (ffmpeg's own build doesn't change without a
 * restart, so re-parsing on every call would be pure waste).
 *
 * `ffmpeg -encoders`/`-hwaccels` only report what this ffmpeg BUILD was
 * compiled to support (e.g. av1_qsv, h264_vaapi appear even with no Intel/AMD
 * hardware present) — never what hardware is actually usable. Reproduced for
 * real on the production Synology (2026-08-23): `av1_qsv` was compiled in,
 * got picked for a 4K HDR transcode, and failed immediately at runtime (no
 * QSV device passed through the container) with no working fallback — a
 * silent-looking "impossible de lire cette vidéo" for the user. Fixed by
 * actually attempting a tiny real encode (`verifyEncoder` below) for every
 * hardware suffix the compiled list claims, and dropping the ones that don't
 * really work from `videoEncoders` before `decidePlayback.ts` ever sees them
 * — `pickVideoEncoderImpl()` only ever checks `videoEncoders.includes(...)`,
 * so this one filter point is enough to keep every hardware-selection call
 * site honest without touching them individually.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolveFfmpegBinary } from "./mediaRuntime";
import type { ServerPlaybackCapabilities } from "./serverCapabilities";


function runFfmpegList(flag: "-encoders" | "-decoders" | "-hwaccels"): Promise<string> {
  return new Promise((resolve) => {
    let p: ChildProcess;
    try {
      p = spawn(resolveFfmpegBinary(), ["-hide_banner", flag], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      resolve("");
      return;
    }
    let out = "";
    p.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf-8"); });
    const t = setTimeout(() => {
      try { p.kill(); } catch { /* already dead */ }
      resolve(out); // whatever printed before the timeout is still useful
    }, 5000);
    p.on("error", () => { clearTimeout(t); resolve(""); });
    p.on("exit", () => { clearTimeout(t); resolve(out); });
  });
}

// `ffmpeg -encoders`/`-decoders` print a fixed-width flag column
// (" V....D ") then the implementation name as the next token — e.g.
// " V....D libx264              libx264 H.264 / AVC..." → name "libx264",
// type "V". The leading "Encoders:"/legend/"------" lines don't start with
// a type letter and are skipped naturally by the regex requiring one.
const LIST_LINE_RE = /^\s*([VAS])[.\w]{5}\s+(\S+)/;

function parseCodecList(raw: string): { video: string[]; audio: string[] } {
  const video: string[] = [];
  const audio: string[] = [];
  for (const line of raw.split("\n")) {
    const m = LIST_LINE_RE.exec(line);
    if (!m) continue;
    const [, type, name] = m;
    // The 3 legend lines (" V..... = Video", " A..... = Audio",
    // " S..... = Subtitle" — confirmed live, always right before the
    // "------" separator) match this same regex shape and would otherwise
    // add a bogus "=" entry to the list — real entries never have "=" as a
    // name, so this is a safe, targeted exclusion rather than a fragile line-count skip.
    if (name === "=") continue;
    if (type === "V") video.push(name);
    else if (type === "A") audio.push(name);
  }
  return { video, audio };
}

function parseHwaccels(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "Hardware acceleration methods:");
}

function hasSuffix(names: string[], suffix: string): boolean {
  return names.some((n) => n.endsWith(suffix));
}

// 320x240 — big enough to clear NVENC's real minimum-frame-size floor
// (confirmed live: a 64x64 test frame gets rejected by h264_nvenc with
// "Frame Dimension less than the minimum supported value" even on a real,
// working GPU — a false negative that has nothing to do with hardware
// availability). Same size already used elsewhere this session to verify
// real NVENC bitrate scaling, so it's a known-good test resolution.
const VERIFY_ARGS_COMMON = ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=0.5", "-frames:v", "1"];

// vaapi encoders need an explicit device + a real hardware frame (plain
// system-memory frames get rejected) — every other hardware family here
// (nvenc/qsv/amf/videotoolbox) opens its own device implicitly from a
// software frame, confirmed live for nvenc/qsv/amf (this sandbox has a real
// NVIDIA GPU: h264_nvenc genuinely succeeds; h264_qsv/h264_amf genuinely
// fail with "no device" — exactly the distinction this function exists to
// make instead of trusting the compiled encoder list).
function verifyEncoderArgs(name: string): string[] {
  if (name.endsWith("_vaapi")) {
    return [
      "-hide_banner", "-loglevel", "error",
      "-vaapi_device", "/dev/dri/renderD128",
      "-f", "lavfi", "-i", "color=c=black:s=320x240:d=0.5",
      "-vf", "format=nv12,hwupload",
      "-frames:v", "1", "-c:v", name, "-f", "null", "-",
    ];
  }
  return [...VERIFY_ARGS_COMMON, "-c:v", name, "-f", "null", "-"];
}

function verifyEncoder(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    let p: ChildProcess;
    try {
      p = spawn(resolveFfmpegBinary(), verifyEncoderArgs(name), { stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      resolve(false);
      return;
    }
    const t = setTimeout(() => {
      try { p.kill(); } catch { /* already dead */ }
      resolve(false);
    }, 4000);
    p.on("error", () => { clearTimeout(t); resolve(false); });
    p.on("exit", (code) => { clearTimeout(t); resolve(code === 0); });
  });
}

const HW_SUFFIXES = ["_nvenc", "_qsv", "_vaapi", "_amf", "_videotoolbox"] as const;

// One representative encoder per hardware family — a missing/unusable
// device fails identically for every codec on that same family (confirmed
// live: h264_qsv and hevc_qsv fail the exact same "Error creating a MFX
// session" without a real Intel device), so testing one per suffix is
// enough and far cheaper than testing every codec variant.
function pickRepresentative(names: string[], suffix: string): string | null {
  const withSuffix = names.filter((n) => n.endsWith(suffix));
  return withSuffix.find((n) => n.startsWith("h264")) ?? withSuffix[0] ?? null;
}

let cached: ServerPlaybackCapabilities | null = null;

export async function detectServerCapabilities(): Promise<ServerPlaybackCapabilities> {
  if (cached) return cached;

  const [encodersRaw, decodersRaw, hwaccelsRaw] = await Promise.all([
    runFfmpegList("-encoders"),
    runFfmpegList("-decoders"),
    runFfmpegList("-hwaccels"),
  ]);

  const encoders = parseCodecList(encodersRaw);
  const decoders = parseCodecList(decodersRaw);
  const hwaccels = parseHwaccels(hwaccelsRaw);
  const ffmpegAvailable = encodersRaw.length > 0 || decodersRaw.length > 0;

  // Only actually spawn a verification encode for families the compiled
  // list claims to have — no point probing a device for a codec ffmpeg
  // itself was never built to touch.
  const verifiedSuffixes = new Set<string>();
  await Promise.all(
    HW_SUFFIXES.map(async (suffix) => {
      const representative = pickRepresentative(encoders.video, suffix);
      if (!representative) return;
      if (await verifyEncoder(representative)) verifiedSuffixes.add(suffix);
    }),
  );

  // Software encoders (no hardware suffix) always pass through untouched;
  // a hardware-suffixed name only survives if its family actually verified.
  const videoEncoders = encoders.video.filter((n) => {
    const suffix = HW_SUFFIXES.find((s) => n.endsWith(s));
    return !suffix || verifiedSuffixes.has(suffix);
  });

  cached = {
    ffmpegAvailable,
    videoDecoders: decoders.video,
    videoEncoders,
    audioDecoders: decoders.audio,
    audioEncoders: encoders.audio,
    hardwareAcceleration: {
      nvenc: verifiedSuffixes.has("_nvenc"),
      nvdec: hasSuffix(decoders.video, "_cuvid") || hwaccels.includes("cuda"),
      qsv: verifiedSuffixes.has("_qsv"),
      vaapi: verifiedSuffixes.has("_vaapi"),
      amf: verifiedSuffixes.has("_amf"),
      videotoolbox: verifiedSuffixes.has("_videotoolbox"),
    },
  };
  if (!ffmpegAvailable) console.error(`[server-capabilities] ffmpeg indisponible ou n'a rien retourné (bin="${resolveFfmpegBinary()}")`);
  return cached;
}
