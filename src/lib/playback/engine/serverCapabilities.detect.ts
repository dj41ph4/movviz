/**
 * Phase 6 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §18-19). Populates the `ServerPlaybackCapabilities` contract (Phase 1) by
 * actually running `ffmpeg -encoders`/`-decoders`/`-hwaccels` and parsing
 * their real output — never assumed from the platform. Memoized for the
 * server process lifetime, same tradeoff as isFfmpegAvailable() in
 * ../ffmpeg/remuxSession.ts (ffmpeg's own build doesn't change without a
 * restart, so re-parsing on every call would be pure waste).
 *
 * Known, unavoidable limitation, stated honestly rather than glossed over:
 * `ffmpeg -encoders`/`-hwaccels` report what this ffmpeg BUILD was compiled
 * to support (e.g. h264_nvenc, h264_qsv both appear even with no NVIDIA or
 * Intel hardware present — confirmed live on this dev machine, which has
 * neither) — not what hardware is actually present. hardwareAcceleration.*
 * below means "ffmpeg would attempt it if asked", not "this machine has a
 * working GPU for it" — an actual encode can still fail at runtime and
 * needs its own fallback (Phase 12/30), this alone can't guarantee success.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { ServerPlaybackCapabilities } from "./serverCapabilities";

function ffmpegBin(): string {
  return process.env.MOVVIZ_FFMPEG_PATH?.trim() || "ffmpeg";
}

function runFfmpegList(flag: "-encoders" | "-decoders" | "-hwaccels"): Promise<string> {
  return new Promise((resolve) => {
    let p: ChildProcess;
    try {
      p = spawn(ffmpegBin(), ["-hide_banner", flag], { stdio: ["ignore", "pipe", "ignore"] });
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

  const allVideoNames = [...encoders.video, ...decoders.video];

  cached = {
    ffmpegAvailable,
    videoDecoders: decoders.video,
    videoEncoders: encoders.video,
    audioDecoders: decoders.audio,
    audioEncoders: encoders.audio,
    hardwareAcceleration: {
      nvenc: hasSuffix(encoders.video, "_nvenc"),
      nvdec: hasSuffix(decoders.video, "_cuvid") || hwaccels.includes("cuda"),
      qsv: hasSuffix(allVideoNames, "_qsv") || hwaccels.includes("qsv"),
      vaapi: hasSuffix(allVideoNames, "_vaapi") || hwaccels.includes("vaapi"),
      amf: hasSuffix(encoders.video, "_amf") || hwaccels.includes("amf"),
      videotoolbox: hasSuffix(allVideoNames, "_videotoolbox") || hwaccels.includes("videotoolbox"),
    },
  };
  if (!ffmpegAvailable) console.error(`[server-capabilities] ffmpeg indisponible ou n'a rien retourné (bin="${ffmpegBin()}")`);
  return cached;
}
