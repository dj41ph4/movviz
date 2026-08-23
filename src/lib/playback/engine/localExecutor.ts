/**
 * Phases 9-13 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §24-28, §31): the Playback Executor for LOCAL (non-Plex) files. It reads a
 * `PlaybackPlan` (decidePlayback(), Phase 4) and carries it out — it never
 * decides strategy itself (§31: "Elle applique le PlaybackPlan. Elle ne
 * décide jamais de la stratégie").
 *
 * This is genuinely new capability, not a rewrite of anything: today, local
 * (non-Plex) playback only has direct byte-range serving
 * (/api/stream/local/[movvizId]/route.ts) — a file whose audio codec the
 * browser can't decode, or that needs a container remux, has NO fallback at
 * all for local-only content. The existing FFmpeg remux engine
 * (remuxSession.ts) only ever fetches from Plex's own HTTP server
 * (resolvePlexPartUrl()) — it cannot be pointed at a local path without
 * changing its contract, so this is a parallel, additive module rather than
 * an edit to that proven file. Session bookkeeping (registry, TTL purge,
 * abort handling, VTT sidecar) deliberately MIRRORS remuxSession.ts's
 * battle-tested patterns (see its own comments for the prod incidents that
 * shaped them) rather than reinventing them.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { Readable } from "node:stream";
import { existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MediaDescriptor } from "./mediaDescriptor";
import type { PlaybackPlan } from "./playbackPlan";

export const MAX_CONCURRENT = 3;
export const SESSION_TTL_MS = 5 * 60_000;
export const AUDIO_BITRATE_K = 192;

export class DuplicateLocalSessionError extends Error {
  constructor(public readonly key: string) {
    super(`[local-engine] session already active: ${key}`);
    this.name = "DuplicateLocalSessionError";
  }
}

export interface StartLocalSessionOptions {
  audioIndex?: number;
  subtitleIndex?: number | null;
  seekToSec?: number;
  audioBitrateK?: number;
}

interface LocalSession {
  key: string;
  proc: ChildProcess;
  stream: ReadableStream<Uint8Array>;
  lastAccess: number;
  seq: number;
  /** Mirrors remuxSession.ts's live-tailed VTT sidecar — only populated for
   *  EXTRACT/CONVERT subtitle actions, never for BURN (burned text is
   *  already in the video, there is no separate track to tail). */
  subtitleVttPath: string | null;
  subtitleVttIndex: number | null;
}

function vttPathFor(key: string): string {
  return path.join(os.tmpdir(), `movviz-local-sub-${Buffer.from(key).toString("base64url")}.vtt`);
}

function removeVttFile(p: string | null | undefined): void {
  if (!p) return;
  try {
    const dir = path.dirname(p);
    if (dir !== os.tmpdir()) return;
    if (!/^movviz-local-sub-[A-Za-z0-9_-]+\.vtt$/.test(path.basename(p))) return;
    if (existsSync(p)) unlinkSync(p);
  } catch { /* déjà supprimé ou verrouillé — non bloquant */ }
}

type SessionRegistry = Map<string, LocalSession>;

function registry(): SessionRegistry {
  const g = globalThis as unknown as {
    __movvizLocalEngineSessions?: SessionRegistry;
    __movvizLocalEnginePurgeTimer?: NodeJS.Timeout;
  };
  if (!g.__movvizLocalEngineSessions) g.__movvizLocalEngineSessions = new Map();
  if (!g.__movvizLocalEnginePurgeTimer) {
    const iv = setInterval(() => purgeStaleSessions(), 60_000);
    if (typeof iv.unref === "function") iv.unref();
    g.__movvizLocalEnginePurgeTimer = iv;
  }
  return g.__movvizLocalEngineSessions;
}

/** Same rationale as remuxSession.ts's identically-named function — a client
 *  abort must never let the later `exit` handler destroy() an
 *  already-closed Web ReadableStream controller (real prod crash there). */
function abortedStreams(): WeakSet<ReadableStream<Uint8Array>> {
  const g = globalThis as unknown as { __movvizLocalEngineAbortedStreams?: WeakSet<ReadableStream<Uint8Array>> };
  if (!g.__movvizLocalEngineAbortedStreams) g.__movvizLocalEngineAbortedStreams = new WeakSet();
  return g.__movvizLocalEngineAbortedStreams;
}

export function markStreamAborted(key: string): void {
  const session = registry().get(key);
  if (session) abortedStreams().add(session.stream);
}

function ffmpegBin(): string {
  return process.env.MOVVIZ_FFMPEG_PATH?.trim() || "ffmpeg";
}

function sessionKey(mediaId: string, userId: string, audioIndex: number, subtitleIndex: number | null, seekSec: number): string {
  return `${mediaId}:${userId}:${audioIndex}:${subtitleIndex ?? "none"}:${seekSec}`;
}

export function activeSessionCount(): number {
  return registry().size;
}

export function findLiveSubtitleVtt(mediaId: string, userId: string, subtitleIndex: number): string | null {
  const prefix = `${mediaId}:${userId}:`;
  let best: LocalSession | null = null;
  for (const s of registry().values()) {
    if (!s.key.startsWith(prefix)) continue;
    if (s.proc.exitCode !== null || s.proc.killed) continue;
    if (s.subtitleVttPath && s.subtitleVttIndex === subtitleIndex && (!best || s.seq > best.seq)) best = s;
  }
  return best?.subtitleVttPath ?? null;
}

/**
 * The `subtitles` ffmpeg filter's `si=` option is the subtitle-TYPE-relative
 * index (the Nth subtitle stream, 0-based) — NOT the absolute ffprobe stream
 * index MediaDescriptor.subtitleTracks[].index carries. Confirmed by a real
 * burn-in test against a 4-subtitle-track file during Phase 13 verification:
 * using the absolute index there silently burned nothing (no error either —
 * a wrong si= just finds no matching stream and skips).
 */
function subtitleRelativeIndex(media: MediaDescriptor, absoluteIndex: number): number {
  return media.subtitleTracks.findIndex((t) => t.index === absoluteIndex);
}

/**
 * Windows path → ffmpeg filtergraph string escaping for the `subtitles`
 * filter. Verified live: the drive-letter colon collides with the filter's
 * own colon-separated option syntax; backslashes need to become forward
 * slashes first (Windows accepts forward slashes in paths, ffmpeg's filter
 * parser does not accept a bare backslash the same way).
 */
function escapeForSubtitlesFilter(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export interface StartLocalSessionResult {
  proc: ChildProcess;
  stream: ReadableStream<Uint8Array>;
  key: string;
}

/**
 * Starts (or refuses to duplicate) a local ffmpeg session executing exactly
 * what `plan` says — never re-deciding compatibility itself. `plan.mode`
 * must be REMUX, DIRECT_STREAM, or TRANSCODE; DIRECT_PLAY belongs on the
 * existing /api/stream/local/[movvizId] byte-range route instead (calling
 * this for DIRECT_PLAY would spawn ffmpeg for zero reason).
 */
export function startLocalSession(
  mediaId: string,
  userId: string,
  filePath: string,
  media: MediaDescriptor,
  plan: PlaybackPlan,
  opts: StartLocalSessionOptions
): StartLocalSessionResult | null {
  if (plan.mode === "DIRECT_PLAY") {
    throw new Error("startLocalSession must not be called for DIRECT_PLAY — use the byte-range route instead");
  }

  const audioIndex = opts.audioIndex ?? media.audioTracks.find((t) => t.default)?.index ?? media.audioTracks[0]?.index ?? 0;
  const subtitleIndex = opts.subtitleIndex ?? null;
  const seekSec = opts.seekToSec && opts.seekToSec > 0 ? Math.floor(opts.seekToSec) : 0;
  const bitrateK = opts.audioBitrateK ?? AUDIO_BITRATE_K;
  const key = sessionKey(mediaId, userId, audioIndex, subtitleIndex, seekSec);

  const reg = registry();
  const existing = reg.get(key);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) {
    throw new DuplicateLocalSessionError(key);
  }
  if (existing) reg.delete(key);

  if (reg.size >= MAX_CONCURRENT) {
    console.error(`[local-engine] refus démarrage ${key} — MAX_CONCURRENT=${MAX_CONCURRENT} atteint`);
    return null;
  }

  const burning = plan.subtitleAction === "BURN" && subtitleIndex !== null;
  const toneMapping = plan.toneMap === true;
  // §1.4 (never a video transcode just for burn-in unless the plan already
  // requires one) is decidePlayback's job, already baked into plan.videoAction
  // — this executor just checks what it was told.
  const needsVideoFilters = burning || toneMapping;
  const needsVideoTranscode = plan.videoAction === "TRANSCODE";

  // Output-seeking (-ss AFTER -i) is REQUIRED only for burn-in: the
  // `subtitles` filter's si= opens its own independent copy of the file,
  // and input-seeking (-ss before -i) rebases the output timeline near 0
  // while that second read still expects the file's original absolute
  // timestamps, so cues silently render at the wrong moment. Confirmed
  // live: with input-seeking, a cue timed at 00:00:59 never appeared;
  // moving -ss after -i fixed it immediately. Tone mapping has no such
  // self-reference (zscale/tonemap operate purely on frames already
  // flowing through this same graph) and copy-only sessions don't touch a
  // filter graph at all — both keep the faster input-seeking (matches
  // remuxSession.ts).
  const outputSeek = burning;

  const args: string[] = ["-v", "error"];
  if (seekSec > 0 && !outputSeek) args.push("-ss", String(seekSec));
  args.push("-i", filePath);
  if (seekSec > 0 && outputSeek) args.push("-ss", String(seekSec));

  // -map uses the ABSOLUTE ffprobe stream index (0:<N>), never the
  // type-relative 0:a:N/0:s:N form — MediaDescriptor only carries absolute
  // indices (mediaProbe.ts uses ffprobe's own stream.index directly), and
  // re-deriving a type-relative count here would be one more place to get
  // it wrong. 0:<N> selects the exact stream unambiguously either way.
  args.push("-map", `0:${media.video.index}`, "-map", `0:${audioIndex}`);

  const videoFilters: string[] = [];
  if (toneMapping) {
    // Standard zscale+tonemap HDR→SDR chain (Hable operator, the same one
    // Jellyfin/Plex use) — verified live against a real Dolby Vision
    // profile 8.1 file (RoboCop 2014): produces a valid, correctly-graded
    // SDR frame (compressed highlights, no blown-out/washed-out colors)
    // rather than raw HDR sample values just re-encoded unconverted, which
    // is what shipped before this filter existed. Must run BEFORE any
    // subtitle burn-in below — burning in first would composite text using
    // the pre-conversion (HDR) colorimetry.
    videoFilters.push("zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709", "tonemap=tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p");
  }
  if (burning && subtitleIndex !== null) {
    const si = subtitleRelativeIndex(media, subtitleIndex);
    if (si >= 0) videoFilters.push(`subtitles='${escapeForSubtitlesFilter(filePath)}':si=${si}`);
    else console.error(`[local-engine] ${key} piste sous-titres ${subtitleIndex} introuvable parmi subtitleTracks — burn-in ignoré`);
  }

  if (needsVideoTranscode) {
    const impl = plan.videoEncoderImpl || "libx264";
    args.push("-c:v", impl);
    if (plan.encoderPreset) args.push("-preset", plan.encoderPreset);
    if (videoFilters.length) args.push("-vf", videoFilters.join(","));
    args.push("-crf", "23", "-pix_fmt", "yuv420p");
  } else if (videoFilters.length) {
    // Burn-in with no OTHER reason to transcode still needs SOME video
    // encoder — reuse the same server-aware pick decidePlayback already
    // made when it required TRANSCODE for a different reason; when it
    // didn't (pure burn-in with an otherwise-compatible codec), fall back
    // to the universal-baseline software encoder, same default as Phase 4's
    // own pickTranscodeVideoCodec() fallback.
    args.push("-c:v", plan.videoEncoderImpl || "libx264", "-vf", videoFilters.join(","), "-crf", "23", "-pix_fmt", "yuv420p");
    if (plan.encoderPreset) args.push("-preset", plan.encoderPreset);
  } else {
    args.push("-c:v", "copy");
  }

  if (plan.audioAction === "TRANSCODE") {
    args.push("-c:a", plan.targetAudioCodec === "aac" || !plan.targetAudioCodec ? "aac" : plan.targetAudioCodec, "-b:a", `${bitrateK}k`);
  } else {
    args.push("-c:a", "copy");
  }

  // Same delay_moov requirement as remuxSession.ts (see its comment) —
  // required whenever audio is copied into an empty_moov fragmented mux.
  args.push(
    "-movflags",
    "frag_keyframe+empty_moov+delay_moov+default_base_moof+omit_tfhd_offset",
    "-f",
    "mp4",
    "pipe:1"
  );

  // Sidecar WebVTT extraction — only for EXTRACT/CONVERT, never alongside
  // BURN (the text is already composited into the video in that case).
  let vttPath: string | null = null;
  let vttSubIndex: number | null = null;
  if (!burning && subtitleIndex !== null && (plan.subtitleAction === "EXTRACT" || plan.subtitleAction === "CONVERT")) {
    vttPath = vttPathFor(key);
    vttSubIndex = subtitleIndex;
    args.push("-map", `0:${subtitleIndex}`, "-c:s", "webvtt", "-f", "webvtt", vttPath);
  }

  const bin = ffmpegBin();
  console.log(`[local-engine] start ${key} — mode=${plan.mode} video=${plan.videoAction}${needsVideoTranscode ? `(${plan.videoEncoderImpl ?? "?"})` : ""} audio=${plan.audioAction} subtitle=${plan.subtitleAction} seek=${seekSec}s`);

  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stderr?.on("data", (d) => console.error(`[local-engine] ${key} stderr: ${String(d).trim()}`));
  proc.on("error", (err) => console.error(`[local-engine] ${key} spawn error: ${err.message}`));
  proc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) console.error(`[local-engine] ${key} exit anormal code=${code} signal=${signal}`);
    else console.log(`[local-engine] ${key} exit code=${code} signal=${signal}`);
    removeVttFile(vttPath);
    reg.delete(key);
  });

  if (!proc.stdout) {
    console.error(`[local-engine] ${key} pas de stdout — abandon`);
    try { proc.kill(); } catch { /* déjà mort */ }
    return null;
  }

  const stream = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;

  // Identical guard to remuxSession.ts — see its extensive comment for the
  // exact prod crash this prevents (uncaughtException on an already-closed
  // Web stream controller after a client abort races the ffmpeg exit).
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null && proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed && !abortedStreams().has(stream)) {
      setImmediate(() => {
        if (proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed && !abortedStreams().has(stream)) {
          proc.stdout.destroy(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    }
  });

  reg.set(key, { key, proc, stream, lastAccess: Date.now(), seq: (existing?.seq ?? 0) + 1, subtitleVttPath: vttPath, subtitleVttIndex: vttSubIndex });
  return { proc, stream, key };
}

export function stopLocalSession(key: string): void {
  const reg = registry();
  const session = reg.get(key);
  if (!session) return;
  reg.delete(key);
  const { proc } = session;
  if (proc.exitCode !== null || proc.killed) return;
  console.log(`[local-engine] stop ${key} — SIGTERM`);
  try { proc.kill("SIGTERM"); } catch { /* déjà mort */ }
  setTimeout(() => {
    if (proc.exitCode === null && !proc.killed) {
      console.log(`[local-engine] ${key} toujours vivant après 3s — SIGKILL`);
      try { proc.kill("SIGKILL"); } catch { /* déjà mort */ }
    }
  }, 3000);
}

export function stopAllForMedia(mediaId: string, userId: string): void {
  const prefix = `${mediaId}:${userId}:`;
  for (const key of Array.from(registry().keys())) {
    if (key.startsWith(prefix)) stopLocalSession(key);
  }
}

export function touchLocalSession(key: string): void {
  const session = registry().get(key);
  if (session) session.lastAccess = Date.now();
}

export function purgeStaleSessions(): void {
  const now = Date.now();
  for (const [key, session] of registry()) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      console.log(`[local-engine] purge session inactive ${key}`);
      stopLocalSession(key);
    }
  }
}
