from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def replace_once(s: str, old: str, new: str, label: str) -> str:
    if old not in s:
        raise AssertionError(f'{label}: pattern not found')
    if s.count(old) != 1:
        raise AssertionError(f'{label}: expected exactly one occurrence, got {s.count(old)}')
    return s.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1) One media runtime resolver for every ffmpeg / ffprobe consumer.
# ---------------------------------------------------------------------------
write('src/lib/playback/engine/mediaRuntime.ts', r'''import fs from "node:fs";
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
''')

# mediaProbe.ts — remote probing support + common ffprobe resolver.
p = 'src/lib/playback/engine/mediaProbe.ts'
s = read(p)
s = replace_once(s,
    'import { spawn, type ChildProcess } from "node:child_process";\nimport type { AudioTrack, HdrType, MediaDescriptor, SubtitleTrack, SubtitleTrackType } from "./mediaDescriptor";\n\n// Mirrors ffmpegBin()/isFfmpegAvailable() in ../ffmpeg/remuxSession.ts —\n// same env var naming convention, same spawn/timeout/memoization shape.\nfunction ffprobeBin(): string {\n  return process.env.MOVVIZ_FFPROBE_PATH?.trim() || "ffprobe";\n}\n',
    'import { spawn, type ChildProcess } from "node:child_process";\nimport type { AudioTrack, HdrType, MediaDescriptor, SubtitleTrack, SubtitleTrackType } from "./mediaDescriptor";\nimport { resolveFfprobeBinary } from "./mediaRuntime";\n',
    'mediaProbe import/runtime')
s = s.replace('const bin = ffprobeBin();', 'const bin = resolveFfprobeBinary();')
s = replace_once(s,
    'function runFfprobe(filePath: string): Promise<FfprobeOutput> {\n  return new Promise((resolve, reject) => {\n    const bin = resolveFfprobeBinary();\n    let p: ChildProcess;\n    try {\n      // -show_streams / -show_format give every field mediaDescriptor.ts\n      // needs in one call — no per-stream follow-up probes.\n      p = spawn(bin, ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath], {\n        stdio: ["ignore", "pipe", "pipe"],\n      });',
    'function runFfprobe(input: string, headers?: Record<string, string>): Promise<FfprobeOutput> {\n  return new Promise((resolve, reject) => {\n    const bin = resolveFfprobeBinary();\n    let p: ChildProcess;\n    try {\n      // -show_streams / -show_format give every field mediaDescriptor.ts\n      // needs in one call — no per-stream follow-up probes.  Plex raw HTTP\n      // sources use the same probe with auth headers, so local and remote\n      // media produce the exact same MediaDescriptor contract.\n      const args: string[] = ["-v", "quiet"];\n      if (headers && Object.keys(headers).length > 0) {\n        const rawHeaders = Object.entries(headers).map(([k, v]) => `${k}: ${v}\\r\\n`).join("");\n        args.push("-headers", rawHeaders);\n      }\n      args.push("-print_format", "json", "-show_format", "-show_streams", input);\n      p = spawn(bin, args, {\n        stdio: ["ignore", "pipe", "pipe"],\n      });',
    'mediaProbe runFfprobe')
s = replace_once(s,
    'export async function probeMediaFile(mediaId: string, filePath: string): Promise<MediaDescriptor> {\n  const raw = await runFfprobe(filePath);',
    'export async function probeMediaFile(\n  mediaId: string,\n  filePath: string,\n  options?: { headers?: Record<string, string>; sourceType?: "local" | "remote" }\n): Promise<MediaDescriptor> {\n  const raw = await runFfprobe(filePath, options?.headers);',
    'mediaProbe signature')
s = replace_once(s, '    source: { type: "local" },', '    source: { type: options?.sourceType ?? "local" },', 'mediaProbe source type')
s += r'''

/** Probe a remote/raw media input (currently Plex raw file HTTP) through the
 * exact same mapper as a local file.  This is deliberately not a Plex
 * transcode: ffprobe reads the original bytes from the raw part endpoint. */
export async function probeRemoteMedia(
  mediaId: string,
  sourceUrl: string,
  headers: Record<string, string>
): Promise<MediaDescriptor> {
  return probeMediaFile(mediaId, sourceUrl, { headers, sourceType: "remote" });
}
'''
write(p, s)

# mediaProbeCache.ts — bounded persistent cache for remote Plex raw probes.
p = 'src/lib/playback/engine/mediaProbeCache.ts'
s = read(p)
s = replace_once(s, 'import { getFfprobeVersion, probeMediaFile } from "./mediaProbe";', 'import { getFfprobeVersion, probeMediaFile, probeRemoteMedia } from "./mediaProbe";', 'remote probe import')
s = replace_once(s,
    'const FILE = path.join(CONFIG_DIR, "media-probe-cache.json");',
    'const FILE = path.join(CONFIG_DIR, "media-probe-cache.json");\nconst REMOTE_FILE = path.join(CONFIG_DIR, "media-probe-remote-cache.json");\nconst REMOTE_TTL_MS = 6 * 60 * 60 * 1000;',
    'remote cache constants')
s += r'''

interface RemoteCacheEntry {
  mediaId: string;
  sourceUrl: string;
  probeVersion: number;
  ffprobeVersion: string | null;
  descriptor: MediaDescriptor;
  updatedAt: number;
}

/** Plex raw-file descriptors cannot use filesystem size/mtime invalidation.
 * Cache them for six hours and re-probe after a server/app restart window or
 * when the resolved part URL changes.  No transcode API is involved. */
export async function getOrProbeRemoteMediaDescriptor(
  mediaId: string,
  sourceUrl: string,
  headers: Record<string, string>,
  force = false
): Promise<MediaDescriptor | null> {
  const entries = readJson<RemoteCacheEntry[]>(REMOTE_FILE, []);
  const ffprobeVersion = await getFfprobeVersion();
  const existing = entries.find((e) => e.mediaId === mediaId);
  if (
    !force && existing &&
    existing.probeVersion === PROBE_VERSION &&
    existing.ffprobeVersion === ffprobeVersion &&
    existing.sourceUrl === sourceUrl &&
    Date.now() - existing.updatedAt < REMOTE_TTL_MS
  ) return existing.descriptor;

  try {
    const descriptor = await probeRemoteMedia(mediaId, sourceUrl, headers);
    const next: RemoteCacheEntry = { mediaId, sourceUrl, probeVersion: PROBE_VERSION, ffprobeVersion, descriptor, updatedAt: Date.now() };
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    writeJsonCached(REMOTE_FILE, [...entries.filter((e) => e.mediaId !== mediaId), next]);
    return descriptor;
  } catch (err) {
    console.error(`[media-probe] remote probe failed for ${mediaId}:`, err);
    return null;
  }
}
'''
write(p, s)

# Replace private ffmpeg-bin helpers with the common resolver.
for p in [
    'src/lib/playback/engine/serverCapabilities.detect.ts',
    'src/lib/playback/engine/serverBenchmark.ts',
    'src/lib/playback/engine/localExecutor.ts',
    'src/lib/playback/ffmpeg/remuxSession.ts',
]:
    s = read(p)
    # import path depends on folder.
    imp = './mediaRuntime' if '/engine/' in p else '../engine/mediaRuntime'
    if 'resolveFfmpegBinary' not in s:
        anchor = 'import { spawn, type ChildProcess } from "node:child_process";'
        s = replace_once(s, anchor, anchor + f'\nimport {{ resolveFfmpegBinary }} from "{imp}";', f'{p}: ffmpeg resolver import')
    s, n = re.subn(r'\nfunction ffmpegBin\(\): string \{\n\s*return process\.env\.MOVVIZ_FFMPEG_PATH\?\.trim\(\) \|\| "ffmpeg";\n\}\n', '\n', s, count=1)
    if n != 1:
        raise AssertionError(f'{p}: ffmpegBin helper not found')
    s = s.replace('ffmpegBin()', 'resolveFfmpegBinary()')
    write(p, s)

# ---------------------------------------------------------------------------
# 2) Benchmark-driven HDR rule + no Plex Transcoder fallback in the planner.
# ---------------------------------------------------------------------------
p = 'src/lib/playback/engine/serverBenchmark.ts'
s = read(p)
s += r'''

export function benchmarkRealtimeFactor(profileId: string): number | null {
  const profile = readServerBenchmark()?.profiles.find((p) => p.id === profileId);
  return profile?.realtimeFactor ?? null;
}
'''
write(p, s)

p = 'src/lib/playback/engine/decidePlayback.ts'
s = read(p)
s = replace_once(s,
    '  network?: { maxBitrateKbps?: number };\n}',
    '  network?: { maxBitrateKbps?: number };\n  /** Real measured server headroom. HDR→SDR is allowed only at >= 3×. */\n  performance?: { toneMapRealtimeFactor?: number | null; software1080pRealtimeFactor?: number | null };\n}',
    'decide performance input')
s = replace_once(s,
    'function checkVideoCompatibility(video: VideoStreamDescriptor, client: ClientPlaybackProfile): CompatibilityResult {',
    'function checkVideoCompatibility(video: VideoStreamDescriptor, client: ClientPlaybackProfile, toneMapAllowed: boolean): CompatibilityResult {',
    'checkVideo signature')
pattern = re.compile(r'  // Absolute product rule \(explicit instruction, 2026-08-24\): HDR/DV content\n.*?  const maxWidth = cap\.maxWidth \?\? client\.maxWidth;', re.S)
replacement = '''  // HDR/DV mismatch is intentionally a SOFT incompatibility.  It only asks\n  // for HDR→SDR conversion when the real benchmark proves at least 3×\n  // realtime headroom; below that threshold the source dynamic range is\n  // preserved instead of sacrificing playback stability.\n  let toneMapNeeded = false;\n  if (video.hdr) {\n    const supportedHdr = cap.hdr ?? [];\n    const directMatch = supportedHdr.includes(video.hdr.type);\n    const dvFallback = video.hdr.type === "dolby-vision" && video.hdr.dolbyVisionBaseLayerCompatibility && supportedHdr.includes(video.hdr.dolbyVisionBaseLayerCompatibility);\n    if (!directMatch && !dvFallback) {\n      reasons.push(video.hdr.type === "dolby-vision" ? "DOLBY_VISION_UNSUPPORTED" : "HDR_UNSUPPORTED");\n      toneMapNeeded = toneMapAllowed;\n    }\n  }\n  const maxWidth = cap.maxWidth ?? client.maxWidth;'''
s, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise AssertionError('decide HDR block not found')
s = replace_once(s,
    '  const videoCheck = checkVideoCompatibility(media.video, client);',
    '  const toneMapAllowed = (input.performance?.toneMapRealtimeFactor ?? 0) >= 3;\n  const videoCheck = checkVideoCompatibility(media.video, client, toneMapAllowed);',
    'decide toneMap allowed')
s = replace_once(s,
    '  const needsVideoTranscode = !videoCheck.compatible || subtitleAction === "BURN";',
    '  const needsVideoTranscode = !videoCheck.compatible || subtitleAction === "BURN" || videoCheck.toneMapNeeded === true;',
    'decide toneMap forces transcode')
# Movviz owns transcoding.  If ffmpeg is absent, report unsupported rather than
# silently delegating to Plex Transcoder.
s = s.replace('mode: "PLEX_FALLBACK"', 'mode: "UNSUPPORTED"')
s = s.replace(', "PLEX_FALLBACK_REQUESTED"', '')
write(p, s)

# prepare route passes real benchmark factors into the pure planner.
p = 'src/app/api/playback/prepare/route.ts'
s = read(p)
s = replace_once(s,
    'import { createSession } from "@/lib/playback/engine/sessionManager";',
    'import { createSession } from "@/lib/playback/engine/sessionManager";\nimport { benchmarkRealtimeFactor } from "@/lib/playback/engine/serverBenchmark";',
    'prepare benchmark import')
s = replace_once(s,
    '  const plan = decidePlayback({ media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality });',
    '  const plan = decidePlayback({\n    media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality,\n    performance: {\n      toneMapRealtimeFactor: benchmarkRealtimeFactor("software_720p_tonemap"),\n      software1080pRealtimeFactor: benchmarkRealtimeFactor("software_1080p"),\n    },\n  });',
    'prepare benchmark planner input')
write(p, s)

# ---------------------------------------------------------------------------
# 3) Tests: selected-track truth, HDR 3× gate, no Plex fallback.
# ---------------------------------------------------------------------------
p = 'scripts/decide-playback.test.ts'
s = read(p)
s = s.replace('test("§61: Plex is only chosen once ffmpeg itself is unavailable", () => {', 'test("ffmpeg unavailable never delegates to Plex Transcoder", () => {')
s = s.replace('  assert.equal(plan.mode, "PLEX_FALLBACK");\n  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));\n  assert.ok(plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));', '  assert.equal(plan.mode, "UNSUPPORTED");\n  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));\n  assert.ok(!plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));')
# Old absolute-HDR tests remain valid because performance defaults to 0. Add
# explicit >=3 tests rather than rewriting their historical regression intent.
s += r'''

test("selected French AAC track is the only audio truth even when English DTS is also present", () => {
  const plan = decidePlayback({
    media: media({
      audioTracks: [
        { index: 1, codec: "dts", language: "eng", channels: 6, default: true },
        { index: 2, codec: "aac", language: "fra", channels: 2, default: false },
      ],
    }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),
    server: FFMPEG_OK,
    selectedAudio: 2,
  });
  assert.equal(plan.audioAction, "COPY");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.mode, "REMUX"); // MKV→MP4 only; DTS on another track is irrelevant
  assert.ok(!plan.reasons.includes("AUDIO_CODEC_UNSUPPORTED"));
});

test("HDR→SDR remains forbidden below the measured 3x threshold", () => {
  const plan = decidePlayback({
    media: media({ container: "mp4", video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "hdr10" } }, audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true }] }),
    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "hevc", hdr: ["sdr"] }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    performance: { toneMapRealtimeFactor: 2.99 },
  });
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.toneMap, undefined);
});

test("HDR→SDR is allowed at a measured 3x or better and becomes a video transcode reason", () => {
  const plan = decidePlayback({
    media: media({ container: "mp4", video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "hdr10" } }, audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true }] }),
    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "hevc", hdr: ["sdr"] }, { codec: "h264", hdr: ["sdr"] }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    performance: { toneMapRealtimeFactor: 3.0 },
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.equal(plan.toneMap, true);
  assert.equal(plan.audioAction, "COPY");
});
'''
write(p, s)

# ---------------------------------------------------------------------------
# 4) Windows installer ships ffmpeg + ffprobe; service points at them.
# ---------------------------------------------------------------------------
p = 'packaging/windows/installer/build.ps1'
s = read(p)
anchor = '# Runtime = local node.exe\nCopy-Item -Force $nodeExe (Join-Path $stage "runtime\\node.exe")\n'
insert = r'''# Runtime = local node.exe
Copy-Item -Force $nodeExe (Join-Path $stage "runtime\node.exe")

# Media runtime — Windows must not depend on the interactive user PATH because
# Movviz runs as a service.  Bundle a static LGPL FFmpeg build (ffmpeg+ffprobe)
# in the installer; mediaRuntime.ts resolves this directory first.
Step "Staging FFmpeg media runtime"
$ffmpegRuntimeDir = Join-Path $stage "runtime\ffmpeg"
New-Item -ItemType Directory -Force $ffmpegRuntimeDir | Out-Null
$ffmpegZip = Join-Path $stage ".tools\ffmpeg.zip"
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n9.0-latest-win64-lgpl-9.0.zip"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing
$ffmpegExtract = Join-Path $stage ".tools\ffmpeg-extract"
if (Test-Path $ffmpegExtract) { Remove-Item $ffmpegExtract -Recurse -Force }
Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force
foreach ($name in @("ffmpeg.exe", "ffprobe.exe")) {
  $found = Get-ChildItem -Path $ffmpegExtract -Recurse -Filter $name | Select-Object -First 1
  if (-not $found) { throw "$name not found in downloaded FFmpeg archive" }
  Copy-Item -Force $found.FullName (Join-Path $ffmpegRuntimeDir $name)
}
& (Join-Path $ffmpegRuntimeDir "ffmpeg.exe") -version | Select-Object -First 1
& (Join-Path $ffmpegRuntimeDir "ffprobe.exe") -version | Select-Object -First 1
Remove-Item -Force $ffmpegZip
Remove-Item -Recurse -Force $ffmpegExtract
'''
s = replace_once(s, anchor, insert, 'windows ffmpeg stage')
write(p, s)

p = 'packaging/windows/installer/movviz-service.xml'
s = read(p)
s = replace_once(s,
    '  <env name="MOVVIZ_ENGINE_PORT" value="9820"/>',
    '  <env name="MOVVIZ_ENGINE_PORT" value="9820"/>\n  <env name="MOVVIZ_FFMPEG_PATH" value="%BASE%\\..\\runtime\\ffmpeg\\ffmpeg.exe"/>\n  <env name="MOVVIZ_FFPROBE_PATH" value="%BASE%\\..\\runtime\\ffmpeg\\ffprobe.exe"/>',
    'service ffmpeg env')
write(p, s)

print('transcoder core v2 patch applied')
