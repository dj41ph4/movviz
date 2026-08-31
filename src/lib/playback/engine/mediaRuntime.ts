import fs from "node:fs";
import path from "node:path";

/**
 * One resolver for every media-process consumer in Movviz.  Environment
 * overrides remain first-class, then a bundled runtime is preferred, then
 * the system PATH is used as the portable Linux/NAS fallback.
 *
 * Windows installer layout:
 *   Movviz/app          <- process.cwd()
 *   Movviz/runtime/ffmpeg/{ffmpeg.exe,ffprobe.exe}
 */
function firstExisting(paths: string[]): string | null {
  for (const candidate of paths) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch { /* continue */ }
  }
  return null;
}

function bundledBinary(name: "ffmpeg" | "ffprobe"): string | null {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const cwd = process.cwd();
  const execDir = path.dirname(process.execPath);
  return firstExisting([
    path.join(cwd, "runtime", "ffmpeg", exe),
    path.join(cwd, "..", "runtime", "ffmpeg", exe),
    path.join(execDir, "ffmpeg", exe),
    path.join(execDir, "runtime", "ffmpeg", exe),
  ]);
}

export function resolveFfmpegBinary(): string {
  return process.env.MOVVIZ_FFMPEG_PATH?.trim() || bundledBinary("ffmpeg") || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

export function resolveFfprobeBinary(): string {
  return process.env.MOVVIZ_FFPROBE_PATH?.trim() || bundledBinary("ffprobe") || (process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
}

export function mediaRuntimeInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    ffmpeg: resolveFfmpegBinary(),
    ffprobe: resolveFfprobeBinary(),
  };
}
