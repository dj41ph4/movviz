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
import { resolveFfmpegBinary } from "./mediaRuntime";
import { Readable } from "node:stream";
import { existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MediaDescriptor } from "./mediaDescriptor";
import type { PlaybackPlan } from "./playbackPlan";
import { MAX_CONCURRENT_TRANSCODES, totalActiveTranscodeSessions } from "./sharedTranscodeLimit";

export const MAX_CONCURRENT = 3;
export const SESSION_TTL_MS = 5 * 60_000;
/** Per-channel-pair AAC bitrate — 192k total for a 2.0 downmix is generous
 *  (Fraunhofer's own guidance puts transparent stereo AAC around 128k), but
 *  a flat 192k applied unscaled to a genuinely-preserved 5.1/7.1 track
 *  (client capable enough that decidePlayback() didn't force a downmix)
 *  would starve it — 192k for 6 channels is ~32k/channel, thin for busy
 *  surround content. Scaling by channel count keeps the CURRENT stereo
 *  default's real bitrate unchanged while giving a not-downmixed multichannel
 *  target a proportionally fair share instead of the same total. */
export const AUDIO_BITRATE_PER_CHANNEL_K = 96;

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
  /** Result of detectSubtitleCharenc() — the caller runs that (async) BEFORE
   *  calling this (sync) function, since a real ffmpeg extraction+decode
   *  check can't happen inside a synchronous call. null/undefined means
   *  "the subtitle is valid UTF-8, or wasn't checked" — never force a
   *  charset override in that case (confirmed live: forcing WINDOWS-1252
   *  onto genuinely valid UTF-8 text corrupts it into "cafÃ©"-style
   *  mojibake, it does not no-op). */
  subtitleCharenc?: string | null;
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


/**
 * TODO_POST_MOTEUR_LECTURE.md §5's own deferred item, revisited with a
 * reliable test harness (2026-08-24) — the previous attempt's synthetic MKV
 * mux itself silently reinterpreted the encoding (`-c:s srt` decodes/
 * re-encodes), masking the real bug. This time verified with `-c:s copy`
 * (a real stream copy, confirmed live to preserve the exact original bytes
 * untouched, unlike `-c:s srt`) muxed into a real multi-stream MKV.
 *
 * A non-UTF-8 SRT (Windows-1252/ISO-8859-1, common on older French
 * releases) crashes BURN outright ("Invalid UTF-8 in decoded subtitles
 * text") and silently produces an empty VTT for EXTRACT/CONVERT — both
 * confirmed live on a genuinely non-UTF-8 test file. Forcing WINDOWS-1252
 * unconditionally is NOT safe either — confirmed live it corrupts a
 * genuinely UTF-8 file into "cafÃ©"-style mojibake — so detection has to
 * happen first, on the REAL raw bytes: `-c:s copy` extraction never invokes
 * the subtitle decoder at all (confirmed live it succeeds on files that
 * make the decode-based paths crash), making it a safe way to read the raw
 * bytes for a UTF-8 validity check before deciding whether to override
 * anything.
 *
 * Returns "WINDOWS-1252" only when the raw bytes are confirmed NOT valid
 * UTF-8 — WINDOWS-1252 rather than plain ISO-8859-1 because it's a strict
 * superset for the printable range that matters here (real ISO-8859-1 text
 * rarely uses the 0x80-0x9F range where they differ), matching the
 * TODO's own scoping to exactly this pair of legacy encodings.
 */
export async function detectSubtitleCharenc(filePath: string, subtitleIndex: number): Promise<string | null> {
  const raw = await new Promise<Buffer | null>((resolve) => {
    let p: ChildProcess;
    try {
      p = spawn(resolveFfmpegBinary(), [
        "-v", "error", "-i", filePath,
        "-map", `0:${subtitleIndex}`, "-c:s", "copy", "-f", "srt", "-",
      ], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    p.stdout?.on("data", (c: Buffer) => chunks.push(c));
    const t = setTimeout(() => { try { p.kill(); } catch { /* already dead */ } resolve(null); }, 5000);
    p.on("error", () => { clearTimeout(t); resolve(null); });
    p.on("exit", (code) => { clearTimeout(t); resolve(code === 0 ? Buffer.concat(chunks) : null); });
  });
  if (!raw || raw.length === 0) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return null; // already valid UTF-8 — never override
  } catch {
    return "WINDOWS-1252";
  }
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

/**
 * Per-encoder-family constant-quality rate control. Verified live against
 * real hardware on this dev machine (RTX 5070 Ti): `-crf` is silently
 * ignored by every hardware encoder (nvenc/qsv/vaapi/amf don't implement
 * that AVOption at all) — a 4K encode with `-c:v h264_nvenc -crf 23` came
 * out at a flat, resolution-independent ~2 Mbit/s, badly blocky at 4K.
 * Switching to nvenc's own `-rc vbr -cq 23` confirmed correct
 * resolution-scaled output (~103 kbit/s at 320x240 vs ~782 kbit/s at 4K on
 * the same test source). qsv/vaapi/amf flags below are taken from each
 * encoder's real `ffmpeg -h encoder=...` option list (confirmed to exist)
 * but NOT verified against real hardware output the way nvenc was — no QSV/
 * VAAPI/AMD hardware was available on this dev machine to test against.
 */
function rateControlArgs(impl: string): string[] {
  if (impl.endsWith("_nvenc")) return ["-rc", "vbr", "-cq", "23"];
  if (impl.endsWith("_qsv")) return ["-global_quality", "23"];
  if (impl.endsWith("_vaapi")) return ["-rc_mode", "CQP", "-qp", "23"];
  if (impl.endsWith("_amf")) return ["-rc", "cqp", "-qp_i", "23", "-qp_p", "23"];
  return ["-crf", "23"]; // libx264/libx265/libsvtav1 and any other software encoder
}

// Same 2s-resync reasoning and exact values as remuxSession.ts's own
// quality-downscale transcode path (see its comment) — without a forced
// keyframe interval, libx264 veryfast on a 24fps source only keyframes
// every ~10s (confirmed live: frames 1/251/501), so scrubbing within an
// already-buffered portion of a transcode session snaps back up to ~10s
// from wherever the user actually clicked. Applies to every codec family —
// GOP flags are generic AVOptions, not encoder-specific.
const GOP_ARGS = ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0"];

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
  // Scaled by the ACTUAL output channel count (post-downmix, when
  // decidePlayback() forced one) — see AUDIO_BITRATE_PER_CHANNEL_K's own
  // comment for why a flat total regardless of channel count is wrong.
  const outputAudioChannels = plan.targetAudioChannels ?? media.audioTracks.find((t) => t.index === audioIndex)?.channels ?? 2;
  const bitrateK = opts.audioBitrateK ?? outputAudioChannels * AUDIO_BITRATE_PER_CHANNEL_K;
  const key = sessionKey(mediaId, userId, audioIndex, subtitleIndex, seekSec);

  const reg = registry();
  const existing = reg.get(key);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) {
    throw new DuplicateLocalSessionError(key);
  }
  if (existing) reg.delete(key);

  // Shared ceiling with the Plex remux engine, not this module's own —
  // see sharedTranscodeLimit.ts's own comment for why.
  if (totalActiveTranscodeSessions() >= MAX_CONCURRENT_TRANSCODES) {
    console.error(`[local-engine] refus démarrage ${key} — MAX_CONCURRENT_TRANSCODES=${MAX_CONCURRENT_TRANSCODES} atteint (partagé avec le moteur Plex)`);
    return null;
  }

  const burning = plan.subtitleAction === "BURN" && subtitleIndex !== null;
  const extractingSubtitle = !burning && subtitleIndex !== null && (plan.subtitleAction === "EXTRACT" || plan.subtitleAction === "CONVERT");
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
  // Global INPUT option, must precede -i — only meaningful for EXTRACT/
  // CONVERT (a real, separate `-map`+`-c:s webvtt` output read through this
  // same -i's subtitle decoder). BURN does NOT use this: the `subtitles`
  // filter re-opens the file independently and needs its OWN `charenc=`
  // filter parameter instead (added below, where the filter string is
  // built) — confirmed live this global flag has zero effect on that path.
  // Produces one harmless warning for the non-subtitle streams on this
  // same input ("Character encoding is only supported with subtitles
  // codecs") — confirmed live it's non-fatal, the subtitle decode still
  // succeeds correctly.
  if (extractingSubtitle && opts.subtitleCharenc) args.push("-sub_charenc", opts.subtitleCharenc);
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
  if (plan.targetVideoWidth) {
    // Scale FIRST, before tonemap/subtitles — the whole point of a
    // resolution cap is keeping a weak server's software encode ahead of
    // real-time (TODO_POST_MOTEUR_LECTURE.md item 4), so every subsequent
    // filter should operate on the smaller frame, not the original. -2
    // keeps height even (required by yuv420p chroma subsampling) while
    // preserving the source aspect ratio. min(...) guards against ever
    // upscaling — decidePlayback() already only sets this when the source
    // is wider, but this is what makes that a real guarantee, not just a
    // caller convention.
    videoFilters.push(`scale=min(${plan.targetVideoWidth}\\,iw):-2`);
  }
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
    // charenc= is THIS filter's own parameter (`ffmpeg -h filter=subtitles`)
    // — confirmed live it's the only thing that actually works here; the
    // global -sub_charenc input flag has no effect since this filter opens
    // its own independent copy of the file (see -i's own comment above).
    const charencSuffix = opts.subtitleCharenc ? `:charenc=${opts.subtitleCharenc}` : "";
    if (si >= 0) videoFilters.push(`subtitles='${escapeForSubtitlesFilter(filePath)}':si=${si}${charencSuffix}`);
    else console.error(`[local-engine] ${key} piste sous-titres ${subtitleIndex} introuvable parmi subtitleTracks — burn-in ignoré`);
  }

  if (needsVideoTranscode) {
    const impl = plan.videoEncoderImpl || "libx264";
    args.push("-c:v", impl);
    if (plan.encoderPreset) args.push("-preset", plan.encoderPreset);
    if (videoFilters.length) args.push("-vf", videoFilters.join(","));
    args.push(...rateControlArgs(impl), ...GOP_ARGS, "-pix_fmt", "yuv420p");
  } else if (videoFilters.length) {
    // Burn-in with no OTHER reason to transcode still needs SOME video
    // encoder — reuse the same server-aware pick decidePlayback already
    // made when it required TRANSCODE for a different reason; when it
    // didn't (pure burn-in with an otherwise-compatible codec), fall back
    // to the universal-baseline software encoder, same default as Phase 4's
    // own pickTranscodeVideoCodec() fallback.
    const impl = plan.videoEncoderImpl || "libx264";
    args.push("-c:v", impl, "-vf", videoFilters.join(","), ...rateControlArgs(impl), ...GOP_ARGS, "-pix_fmt", "yuv420p");
    if (plan.encoderPreset) args.push("-preset", plan.encoderPreset);
  } else {
    args.push("-c:v", "copy");
  }

  if (plan.audioAction === "TRANSCODE") {
    args.push("-c:a", plan.targetAudioCodec === "aac" || !plan.targetAudioCodec ? "aac" : plan.targetAudioCodec, "-b:a", `${bitrateK}k`);
    // -ac is NOT optional whenever the plan set a target — omitting it
    // leaves ffmpeg's default "keep the source's own channel count",
    // which for a 5.1/7.1 source produces 5.1/7.1 AAC. Confirmed live:
    // played over a genuine 2.0 output, that silently dropped the center
    // channel (dialogue) instead of ffmpeg properly folding it into L/R —
    // "missing voices", not a subtle quality loss. decidePlayback() only
    // ever sets targetAudioChannels when the source truly exceeds the
    // client's declared cap, so this never downmixes audio the client can
    // actually play natively.
    if (plan.targetAudioChannels) args.push("-ac", String(plan.targetAudioChannels));
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
  if (extractingSubtitle && subtitleIndex !== null) {
    vttPath = vttPathFor(key);
    vttSubIndex = subtitleIndex;
    args.push("-map", `0:${subtitleIndex}`, "-c:s", "webvtt", "-f", "webvtt", vttPath);
  }

  const bin = resolveFfmpegBinary();
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

/**
 * Same gap as the old Plex remux engine (not a regression — TODO_POST_MOTEUR_LECTURE.md
 * §5's own note: neither engine had a process-exit cleanup hook). A `next
 * dev` hot-reload restart, or a `docker restart`/`npm run start` respawn,
 * previously left any in-flight ffmpeg child process running orphaned —
 * still holding the source file open and burning CPU on a NAS that has very
 * little to spare (see the DS923+ investigation, 2026-08-24). Wired into
 * instrumentation.ts's process signal handlers so a graceful shutdown always
 * kills every child it spawned, mirroring stopLocalSession()'s own
 * SIGTERM-then-SIGKILL escalation for each one.
 */
export function stopAllLocalSessions(): void {
  for (const key of Array.from(registry().keys())) stopLocalSession(key);
}
