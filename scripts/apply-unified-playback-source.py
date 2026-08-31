from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def r(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def w(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def one(s: str, old: str, new: str, label: str) -> str:
    c = s.count(old)
    if c != 1:
        raise AssertionError(f'{label}: expected 1 occurrence, got {c}')
    return s.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1. Rename the local-only executor: it now executes local files OR Plex raw
#    HTTP sources.  Planner stays the sole decision-maker.
# ---------------------------------------------------------------------------
old_path = ROOT / 'src/lib/playback/engine/localExecutor.ts'
new_path = ROOT / 'src/lib/playback/engine/transcoderExecutor.ts'
if not old_path.exists():
    raise AssertionError('localExecutor.ts missing')
s = old_path.read_text(encoding='utf-8')

s = re.sub(r'^/\*\*.*?\*/\n', '''/**
 * Unified Movviz playback executor.
 *
 * It executes a PlaybackPlan against either a local filesystem path or the
 * original Plex part URL. Plex is only a raw byte source here: no Plex
 * Transcoder/MDE endpoint is ever invoked by this module. The selected audio
 * and subtitle indexes are already fixed by /api/playback/prepare before
 * this executor starts.
 */
''', s, count=1, flags=re.S)
s = s.replace('DuplicateLocalSessionError', 'DuplicateTranscoderSessionError')
s = s.replace('StartLocalSessionOptions', 'StartTranscoderSessionOptions')
s = s.replace('StartLocalSessionResult', 'StartTranscoderSessionResult')
s = s.replace('LocalSession', 'TranscoderSession')
s = s.replace('startLocalSession', 'startTranscoderSession')
s = s.replace('stopLocalSession', 'stopTranscoderSession')
s = s.replace('stopAllLocalSessions', 'stopAllTranscoderSessions')
s = s.replace('touchLocalSession', 'touchTranscoderSession')
s = s.replace('__movvizLocalEngineSessions', '__movvizTranscoderSessions')
s = s.replace('__movvizLocalEnginePurgeTimer', '__movvizTranscoderPurgeTimer')
s = s.replace('__movvizLocalEngineAbortedStreams', '__movvizTranscoderAbortedStreams')
s = s.replace('[local-engine]', '[transcoder]')
s = s.replace('movviz-local-sub-', 'movviz-transcoder-sub-')
s = s.replace('^movviz-local-sub-', '^movviz-transcoder-sub-')

# Add generic source contract after bitrate constant.
anchor = 'export const AUDIO_BITRATE_PER_CHANNEL_K = 96;\n'
source_contract = '''export const AUDIO_BITRATE_PER_CHANNEL_K = 96;

export interface TranscoderInput {
  /** Local path or original Plex part URL. */
  uri: string;
  /** Input HTTP headers, used for Plex raw-file authentication. */
  headers?: Record<string, string>;
  /** Present only for a real local file; required by libass burn-in. */
  localPath?: string;
  /** Stable, non-secret identity used only in the in-memory session key. */
  sourceKey: string;
}

/** PGS/image/text burn-in through the current libass file filter requires a
 * local path. Remote Plex raw sources still support DIRECT/EXTRACT/CONVERT;
 * a burn request is rejected explicitly rather than secretly escalating to
 * Plex Transcoder. */
export class RemoteSubtitleBurnUnsupportedError extends Error {
  constructor() {
    super("remote_subtitle_burn_unsupported");
    this.name = "RemoteSubtitleBurnUnsupportedError";
  }
}

function appendInputHeaders(args: string[], headers?: Record<string, string>): void {
  if (!headers || Object.keys(headers).length === 0) return;
  const raw = Object.entries(headers).map(([k, v]) => `${k}: ${v}\\r\\n`).join("");
  args.push("-headers", raw);
}
'''
s = one(s, anchor, source_contract, 'executor source contract')

# charenc detector accepts remote authenticated inputs too.
s = one(s,
'''export async function detectSubtitleCharenc(filePath: string, subtitleIndex: number): Promise<string | null> {''',
'''export async function detectSubtitleCharenc(input: TranscoderInput, subtitleIndex: number): Promise<string | null> {''',
'charenc signature')
s = one(s,
'''      p = spawn(resolveFfmpegBinary(), [
        "-v", "error", "-i", filePath,
        "-map", `0:${subtitleIndex}`, "-c:s", "copy", "-f", "srt", "-",
      ], { stdio: ["ignore", "pipe", "ignore"] });''',
'''      const args = ["-v", "error"];
      appendInputHeaders(args, input.headers);
      args.push("-i", input.uri, "-map", `0:${subtitleIndex}`, "-c:s", "copy", "-f", "srt", "-");
      p = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "pipe", "ignore"] });''',
'charenc spawn')

# Session key includes a stable source key so local and Plex-raw runs never collide.
s = one(s,
'''function sessionKey(mediaId: string, userId: string, audioIndex: number, subtitleIndex: number | null, seekSec: number): string {
  return `${mediaId}:${userId}:${audioIndex}:${subtitleIndex ?? "none"}:${seekSec}`;
}''',
'''function sessionKey(mediaId: string, userId: string, sourceKey: string, audioIndex: number, subtitleIndex: number | null, seekSec: number): string {
  return `${mediaId}:${userId}:${sourceKey}:${audioIndex}:${subtitleIndex ?? "none"}:${seekSec}`;
}''',
'session key')

# Generic start signature.
s = one(s,
'''export function startTranscoderSession(
  mediaId: string,
  userId: string,
  filePath: string,
  media: MediaDescriptor,
  plan: PlaybackPlan,
  opts: StartTranscoderSessionOptions
): StartTranscoderSessionResult | null {''',
'''export function startTranscoderSession(
  mediaId: string,
  userId: string,
  input: TranscoderInput,
  media: MediaDescriptor,
  plan: PlaybackPlan,
  opts: StartTranscoderSessionOptions
): StartTranscoderSessionResult | null {''',
'start signature')
s = one(s,
'''  const key = sessionKey(mediaId, userId, audioIndex, subtitleIndex, seekSec);''',
'''  const key = sessionKey(mediaId, userId, input.sourceKey, audioIndex, subtitleIndex, seekSec);''',
'start session key')

# Remote input headers must be input options immediately before -i.
s = one(s,
'''  if (extractingSubtitle && opts.subtitleCharenc) args.push("-sub_charenc", opts.subtitleCharenc);
  if (seekSec > 0 && !outputSeek) args.push("-ss", String(seekSec));
  args.push("-i", filePath);''',
'''  if (extractingSubtitle && opts.subtitleCharenc) args.push("-sub_charenc", opts.subtitleCharenc);
  if (seekSec > 0 && !outputSeek) args.push("-ss", String(seekSec));
  appendInputHeaders(args, input.headers);
  args.push("-i", input.uri);''',
'input headers')

# Burn-in explicitly requires a local path; never invoke Plex Transcoder.
s = one(s,
'''  if (burning && subtitleIndex !== null) {
    const si = subtitleRelativeIndex(media, subtitleIndex);''',
'''  if (burning && subtitleIndex !== null) {
    if (!input.localPath) throw new RemoteSubtitleBurnUnsupportedError();
    const si = subtitleRelativeIndex(media, subtitleIndex);''',
'burn local guard')
s = s.replace("escapeForSubtitlesFilter(filePath)", "escapeForSubtitlesFilter(input.localPath!)")

# Comments and labels that still claim local-only execution.
s = s.replace('local ffmpeg session', 'Movviz ffmpeg session')
s = s.replace('local file', 'media source')
s = s.replace('local ffmpeg', 'Movviz ffmpeg')
s = s.replace('local-engine', 'transcoder')

new_path.write_text(s, encoding='utf-8')
old_path.unlink()

# Update imports and renamed symbols throughout TS/TSX source and scripts.
replacements = {
    'playback/engine/localExecutor': 'playback/engine/transcoderExecutor',
    './localExecutor': './transcoderExecutor',
    '../engine/localExecutor': '../engine/transcoderExecutor',
    'DuplicateLocalSessionError': 'DuplicateTranscoderSessionError',
    'StartLocalSessionOptions': 'StartTranscoderSessionOptions',
    'StartLocalSessionResult': 'StartTranscoderSessionResult',
    'startLocalSession': 'startTranscoderSession',
    'stopLocalSession': 'stopTranscoderSession',
    'stopAllLocalSessions': 'stopAllTranscoderSessions',
    'touchLocalSession': 'touchTranscoderSession',
}
for base in [ROOT / 'src', ROOT / 'scripts']:
    for p in base.rglob('*'):
        if p.suffix not in {'.ts', '.tsx'} or p == new_path:
            continue
        text = p.read_text(encoding='utf-8')
        updated = text
        for a, b in replacements.items():
            updated = updated.replace(a, b)
        if updated != text:
            p.write_text(updated, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2. Session stores the already-resolved source. No later layer re-decides it.
# ---------------------------------------------------------------------------
p = 'src/lib/playback/engine/sessionManager.ts'
s = r(p)
s = one(s,
'''import type { PlaybackMode, PlaybackPlan, SubtitleAction, TrackAction } from "./playbackPlan";

export interface PlaybackSession {''',
'''import type { PlaybackMode, PlaybackPlan, SubtitleAction, TrackAction } from "./playbackPlan";

export type PlaybackSessionSource =
  | { type: "local"; uri: string; localPath: string; sourceKey: string }
  | { type: "plex_raw"; uri: string; headers: Record<string, string>; ratingKey: string; sourceKey: string };

export interface PlaybackSession {''',
'session source type')
s = one(s, '  mediaId: string;\n\n  mode: PlaybackMode;', '  mediaId: string;\n  source: PlaybackSessionSource;\n\n  mode: PlaybackMode;', 'session source field')
s = one(s, '  mediaId: string;\n  mode: PlaybackMode;\n  selectedAudio?: number | null;', '  mediaId: string;\n  source?: PlaybackSessionSource;\n  mode: PlaybackMode;\n  selectedAudio?: number | null;', 'create source input')
s = one(s, '    mediaId: input.mediaId,\n    mode: input.mode,', '    mediaId: input.mediaId,\n    source: input.source ?? { type: "local", uri: input.mediaId, localPath: input.mediaId, sourceKey: "local" },\n    mode: input.mode,', 'create source assign')
# Plex fallback state is obsolete now; preserve field for debug compatibility but never infer from mode.
s = s.replace('    plexFallbackUsed: input.mode === "PLEX_FALLBACK",', '    plexFallbackUsed: false,')
s = s.replace('  if (nextMode === "PLEX_FALLBACK") session.plexFallbackUsed = true;\n', '')
w(p, s)

# ---------------------------------------------------------------------------
# 3. /prepare chooses LOCAL first, otherwise the original Plex part URL.
#    The exact source is persisted in the session and returned as diagnostics.
# ---------------------------------------------------------------------------
p = 'src/app/api/playback/prepare/route.ts'
s = r(p)
s = one(s,
'''import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";''',
'''import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";''',
'prepare remote imports')
s = s.replace('tryStartLocalEngine()', 'tryStartUnifiedEngine()')
s = s.replace('real local file', 'real media source')
s = s.replace('local file (see resolveLocalFilePath in sourceResolver.ts)', 'local file or original Plex raw part')
s = one(s,
'''  const mediaId = typeof b.mediaId === "string" ? b.mediaId.trim() : "";
  const clientProfile = b.clientProfile as ClientPlaybackProfile | undefined;''',
'''  const mediaId = typeof b.mediaId === "string" ? b.mediaId.trim() : "";
  const ratingKey = typeof b.ratingKey === "string" ? b.ratingKey.trim() : "";
  const clientProfile = b.clientProfile as ClientPlaybackProfile | undefined;''',
'prepare rating key')
old_resolve = '''  // Movie mediaId or `${seriesId}:s{season}e{episode}` episode mediaId —
  // resolveLocalFilePath tells the two apart (see sourceResolver.ts) so this
  // route needs no branching of its own.
  const resolution = resolveLocalFilePath(mediaId);
  if (!resolution.ok) {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }
  const filePath = resolution.path;

  const media = await getOrProbeMediaDescriptor(mediaId, filePath);
  if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
'''
new_resolve = '''  // Source resolution happens ONCE, before planning. Local bytes are always
  // preferred. If the file is not locally resolvable and a real Plex
  // ratingKey exists, Plex contributes only its original /library/parts URL.
  // No /transcode endpoint is used anywhere in this engine.
  const resolution = resolveLocalFilePath(mediaId);
  let media;
  let source;
  let directUrl: string;
  if (resolution.ok) {
    media = await getOrProbeMediaDescriptor(mediaId, resolution.path);
    if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
    source = { type: "local" as const, uri: resolution.path, localPath: resolution.path, sourceKey: "local" };
    const episodeMatch = /^(.+):s(\\d+)e(\\d+)$/.exec(mediaId);
    directUrl = episodeMatch
      ? `/api/stream/local/episode/${encodeURIComponent(episodeMatch[1])}/${episodeMatch[2]}/${episodeMatch[3]}`
      : `/api/stream/local/${encodeURIComponent(mediaId)}`;
  } else if (ratingKey) {
    const part = await resolvePlexPartUrl(ratingKey, user.id);
    if (!part) return NextResponse.json({ error: "plex_raw_source_unavailable" }, { status: 404 });
    media = await getOrProbeRemoteMediaDescriptor(mediaId, part.sourceUrl, part.headers);
    if (!media) return NextResponse.json({ error: "plex_raw_probe_failed" }, { status: 502 });
    source = {
      type: "plex_raw" as const,
      uri: part.sourceUrl,
      headers: part.headers,
      ratingKey,
      sourceKey: `plex:${ratingKey}`,
    };
    directUrl = `/api/stream/${encodeURIComponent(ratingKey)}`;
  } else {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }
'''
s = one(s, old_resolve, new_resolve, 'prepare source resolution')
s = one(s,
'''    mediaId,
    mode: plan.mode,''',
'''    mediaId,
    source,
    mode: plan.mode,''',
'prepare session source')
old_url = '''  // DIRECT_PLAY needs no ffmpeg process at all — point straight at the
  // existing, already-working byte-range route (Range support, 206 partial
  // content) instead of routing through a session-backed stream endpoint
  // that would spawn a process for zero reason. Every other mode (REMUX/
  // DIRECT_STREAM/TRANSCODE) needs the real ffmpeg session, executed by
  // localExecutor.ts (Phases 9-13) via the session-stream route below.
  const episodeMatch = /^(.+):s(\\d+)e(\\d+)$/.exec(mediaId);
  const streamUrl =
    plan.mode === "DIRECT_PLAY"
      ? episodeMatch
        ? `/api/stream/local/episode/${encodeURIComponent(episodeMatch[1])}/${episodeMatch[2]}/${episodeMatch[3]}`
        : `/api/stream/local/${encodeURIComponent(mediaId)}`
      : `/api/playback/session/${session.sessionId}/stream`;
'''
new_url = '''  // DIRECT_PLAY uses the raw-byte route for the already-selected source.
  // REMUX / DIRECT_STREAM / TRANSCODE all use the same Movviz executor.
  const streamUrl = plan.mode === "DIRECT_PLAY"
    ? directUrl
    : `/api/playback/session/${session.sessionId}/stream`;
'''
s = one(s, old_url, new_url, 'prepare stream url')
s = one(s,
'''    tracks: { audio: media.audioTracks, subtitle: media.subtitleTracks },''',
'''    tracks: { audio: media.audioTracks, subtitle: media.subtitleTracks },
    source: { type: source.type },''',
'prepare response source')
w(p, s)

# ---------------------------------------------------------------------------
# 4. Session stream executes the persisted source; no source re-resolution.
# ---------------------------------------------------------------------------
p = 'src/app/api/playback/session/[sessionId]/stream/route.ts'
s = r(p)
s = s.replace('import { resolveLocalFilePath } from "@/lib/playback/sourceResolver";\n', '')
s = one(s,
'''import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";''',
'''import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";''',
'stream descriptor import')
# imports were globally renamed above; add generic input/error if missing
s = s.replace('  DuplicateTranscoderSessionError,\n', '  DuplicateTranscoderSessionError,\n  RemoteSubtitleBurnUnsupportedError,\n')
old_source = '''  const resolution = resolveLocalFilePath(session.mediaId);
  if (!resolution.ok) {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }
  const filePath = resolution.path;

  const media = await getOrProbeMediaDescriptor(session.mediaId, filePath);
  if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
'''
new_source = '''  const input = session.source.type === "local"
    ? { uri: session.source.uri, localPath: session.source.localPath, sourceKey: session.source.sourceKey }
    : { uri: session.source.uri, headers: session.source.headers, sourceKey: session.source.sourceKey };
  const media = session.source.type === "local"
    ? await getOrProbeMediaDescriptor(session.mediaId, session.source.localPath)
    : await getOrProbeRemoteMediaDescriptor(session.mediaId, session.source.uri, session.source.headers);
  if (!media) return NextResponse.json({ error: "source_unavailable" }, { status: 404 });
'''
s = one(s, old_source, new_source, 'stream persisted source')
s = s.replace('detectSubtitleCharenc(filePath, session.selectedSubtitle)', 'detectSubtitleCharenc(input, session.selectedSubtitle)')
s = s.replace('startTranscoderSession(session.mediaId, user.id, filePath, media, session.plan, {', 'startTranscoderSession(session.mediaId, user.id, input, media, session.plan, {')
s = one(s,
'''    if (e instanceof DuplicateTranscoderSessionError) {''',
'''    if (e instanceof RemoteSubtitleBurnUnsupportedError) {
      return NextResponse.json({ error: "remote_subtitle_burn_unsupported" }, { status: 422 });
    }
    if (e instanceof DuplicateTranscoderSessionError) {''',
'stream remote burn error')
s = s.replace('[local-engine]', '[transcoder]')
w(p, s)

# ---------------------------------------------------------------------------
# 5. Subtitle endpoint also follows the persisted source and common runtime.
# ---------------------------------------------------------------------------
p = 'src/app/api/playback/session/[sessionId]/subtitle/route.ts'
s = r(p)
s = s.replace('import { resolveLocalFilePath } from "@/lib/playback/sourceResolver";\n', '')
s = one(s,
'''import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";''',
'''import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { resolveFfmpegBinary } from "@/lib/playback/engine/mediaRuntime";''',
'subtitle descriptor/runtime import')
old_source = '''  const resolution = resolveLocalFilePath(session.mediaId);
  if (!resolution.ok) {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }
  const filePath = resolution.path;

  const media = await getOrProbeMediaDescriptor(session.mediaId, filePath);
  if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
'''
new_source = '''  const media = session.source.type === "local"
    ? await getOrProbeMediaDescriptor(session.mediaId, session.source.localPath)
    : await getOrProbeRemoteMediaDescriptor(session.mediaId, session.source.uri, session.source.headers);
  if (!media) return NextResponse.json({ error: "source_unavailable" }, { status: 404 });
'''
s = one(s, old_source, new_source, 'subtitle persisted source')
old_args = '''  const args = ["-v", "error", "-i", filePath, "-map", `0:${subtitleIndex}`, "-f", "webvtt", "pipe:1"];
  const proc = spawn(process.env.MOVVIZ_FFMPEG_PATH?.trim() || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });'''
new_args = '''  const args = ["-v", "error"];
  if (session.source.type === "plex_raw") {
    const rawHeaders = Object.entries(session.source.headers).map(([k, v]) => `${k}: ${v}\\r\\n`).join("");
    if (rawHeaders) args.push("-headers", rawHeaders);
  }
  args.push("-i", session.source.uri, "-map", `0:${subtitleIndex}`, "-f", "webvtt", "pipe:1");
  const proc = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "pipe", "pipe"] });'''
s = one(s, old_args, new_args, 'subtitle remote args')
s = s.replace('[local-engine]', '[transcoder]')
s = s.replace('Local-file counterpart', 'Unified-source counterpart')
s = s.replace('localExecutor.ts', 'transcoderExecutor.ts')
w(p, s)

# ---------------------------------------------------------------------------
# 6. Add tests for source persistence and remove obsolete Plex fallback state.
# ---------------------------------------------------------------------------
w('scripts/playback-source-session.test.ts', r'''import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, endSession } from "../src/lib/playback/engine/sessionManager.ts";
import type { PlaybackPlan } from "../src/lib/playback/engine/playbackPlan.ts";

const plan: PlaybackPlan = {
  mode: "DIRECT_STREAM",
  containerAction: "REMUX",
  targetContainer: "mp4",
  videoAction: "COPY",
  audioAction: "TRANSCODE",
  targetAudioCodec: "aac",
  subtitleAction: "NONE",
  protocol: "PROGRESSIVE",
  reasons: ["AUDIO_CODEC_UNSUPPORTED"],
};

test("playback session persists the exact Plex raw source selected before planning", () => {
  const s = createSession({
    userId: "u1", deviceId: "d1", clientType: "desktop-web", mediaId: "movie-1",
    source: {
      type: "plex_raw",
      uri: "http://plex/library/parts/42/file.mkv",
      headers: { "X-Plex-Token": "secret" },
      ratingKey: "123",
      sourceKey: "plex:123",
    },
    mode: plan.mode, videoAction: plan.videoAction, audioAction: plan.audioAction,
    subtitleAction: plan.subtitleAction, plan, selectedAudio: 2,
  });
  assert.equal(s.source.type, "plex_raw");
  if (s.source.type === "plex_raw") {
    assert.equal(s.source.ratingKey, "123");
    assert.equal(s.source.uri.endsWith("file.mkv"), true);
    assert.equal(s.source.headers["X-Plex-Token"], "secret");
  }
  assert.equal(s.selectedAudio, 2);
  assert.equal(s.plexFallbackUsed, false);
  endSession(s.sessionId);
});

test("local playback session persists the resolved local path", () => {
  const s = createSession({
    userId: "u2", deviceId: "d2", clientType: "desktop-web", mediaId: "movie-2",
    source: { type: "local", uri: "/media/movie.mkv", localPath: "/media/movie.mkv", sourceKey: "local" },
    mode: "DIRECT_PLAY", videoAction: "COPY", audioAction: "COPY", subtitleAction: "NONE",
    plan: { ...plan, mode: "DIRECT_PLAY", containerAction: "COPY", audioAction: "COPY", reasons: [] },
  });
  assert.equal(s.source.type, "local");
  if (s.source.type === "local") assert.equal(s.source.localPath, "/media/movie.mkv");
  endSession(s.sessionId);
});
''')

print('unified playback source migration applied')
