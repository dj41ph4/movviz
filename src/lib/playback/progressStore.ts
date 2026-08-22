import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { completionBoundaryMs, canComplete, isPlausiblePlaybackAdvance, MIN_REAL_PLAYBACK_MS, type CompletionBoundarySource } from "./progressPolicy";
import { getPlaybackMarkers } from "./markers/store";
import { setWatchedMovies, setWatchedEpisodes } from "@/lib/plex/watchStore";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "playback-progress.json");
const g = globalThis as typeof globalThis & { __movvizPlaybackProgress?: PlaybackProgressStore; __movvizPlaybackSessions?: Map<string, PlaybackSession> };

export interface PlaybackProgress {
  userId: string;
  /** Stable Movviz identity; optional for legacy Plex-only sessions. */
  mediaId?: string;
  ratingKey: string;
  mediaType: "movie" | "episode";
  tmdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  title?: string;
  durationMs: number;
  resumeOffsetMs: number | null;
  actualPlayedMs: number;
  eligibleForResume: boolean;
  watched: boolean;
  watchedAt: number | null;
  completionBoundaryMs: number | null;
  boundarySource: CompletionBoundarySource;
  lastPositionMs: number;
  lastPlayedAt: number | null;
  updatedAt: number;
  revision: number;
  plex: { lastImportedAt: number | null; lastExportedAt: number | null; pendingAction: "none" | "progress" | "scrobble" | "unscrobble"; lastError: string | null };
}

export interface PlaybackSession {
  id: string;
  userId: string;
  ratingKey: string;
  mediaId?: string;
  startedAt: number;
  lastHeartbeatAt: number;
  lastPositionMs: number;
  lastSequence: number;
  actualPlayedMs: number;
  seekPending: boolean;
  durationMs: number;
  mediaType: "movie" | "episode";
}

interface PlaybackProgressStore { version: 1; byUser: Record<string, Record<string, PlaybackProgress>> }

function store(): PlaybackProgressStore {
  return (g.__movvizPlaybackProgress ??= readJsonCached<PlaybackProgressStore>(FILE, { version: 1, byUser: {} }));
}
function persist() { writeJsonCached(FILE, store()); }
function id() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
function get(userId: string, ratingKey: string, mediaId?: string): PlaybackProgress | null {
  const bucket = store().byUser[userId] ?? {};
  return (mediaId ? bucket[mediaId] : undefined) ?? bucket[ratingKey] ?? null;
}

function ensure(userId: string, ratingKey: string, input: { mediaId?: string; mediaType: "movie" | "episode"; durationMs: number; tmdbId?: number; seasonNumber?: number; episodeNumber?: number; title?: string }): PlaybackProgress {
  const key = input.mediaId ?? ratingKey;
  const prior = get(userId, ratingKey, input.mediaId);
  const markers = getPlaybackMarkers(ratingKey);
  const boundary = completionBoundaryMs(input.durationMs, markers, input.mediaType);
  if (prior) {
    // Promote legacy Plex-keyed progress to the canonical Movviz identity as
    // soon as the player provides it. This keeps old resume data usable while
    // ensuring future writes are independent from Plex rating keys.
    if (input.mediaId && prior.mediaId !== input.mediaId) {
      const bucket = store().byUser[userId] ?? {};
      const oldKey = Object.keys(bucket).find((key) => bucket[key] === prior);
      if (oldKey && oldKey !== input.mediaId) {
        delete bucket[oldKey];
        bucket[input.mediaId] = prior;
      }
      prior.mediaId = input.mediaId;
    }
    prior.durationMs = input.durationMs || prior.durationMs;
    prior.mediaType = input.mediaType;
    prior.completionBoundaryMs = boundary.boundaryMs;
    prior.boundarySource = boundary.source;
    if (input.tmdbId != null) prior.tmdbId = input.tmdbId;
    if (input.title) prior.title = input.title;
    if (input.seasonNumber != null) prior.seasonNumber = input.seasonNumber;
    if (input.episodeNumber != null) prior.episodeNumber = input.episodeNumber;
    return prior;
  }
  const now = Date.now();
  const next: PlaybackProgress = { userId, ratingKey, mediaId: input.mediaId, mediaType: input.mediaType, durationMs: input.durationMs, tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, episodeNumber: input.episodeNumber, title: input.title, resumeOffsetMs: null, actualPlayedMs: 0, eligibleForResume: false, watched: false, watchedAt: null, completionBoundaryMs: boundary.boundaryMs, boundarySource: boundary.source, lastPositionMs: 0, lastPlayedAt: null, updatedAt: now, revision: 1, plex: { lastImportedAt: null, lastExportedAt: null, pendingAction: "none", lastError: null } };
  (store().byUser[userId] ??= {})[key] = next;
  return next;
}

export function getPlaybackProgress(userId: string, ratingKey: string, mediaId?: string): PlaybackProgress | null { return get(userId, ratingKey, mediaId); }
export function listPlaybackProgress(userId: string): PlaybackProgress[] { return Object.values(store().byUser[userId] ?? {}).filter((p) => !p.watched && p.eligibleForResume && (p.resumeOffsetMs ?? 0) > 0); }

export function openPlaybackSession(userId: string, input: { ratingKey: string; mediaId?: string; mediaType: "movie" | "episode"; durationMs: number; tmdbId?: number; seasonNumber?: number; episodeNumber?: number; title?: string }): { session: PlaybackSession; progress: PlaybackProgress } {
  const progress = ensure(userId, input.ratingKey, input);
  const now = Date.now();
  const session: PlaybackSession = { id: id(), userId, ratingKey: input.ratingKey, mediaId: input.mediaId, startedAt: now, lastHeartbeatAt: now, lastPositionMs: progress.watched ? 0 : (progress.resumeOffsetMs ?? 0), lastSequence: -1, actualPlayedMs: 0, seekPending: false, durationMs: input.durationMs, mediaType: input.mediaType };
  (g.__movvizPlaybackSessions ??= new Map()).set(session.id, session);
  return { session, progress };
}

export function getPlaybackSession(sessionId: string): PlaybackSession | null { return g.__movvizPlaybackSessions?.get(sessionId) ?? null; }

/**
 * The player learns the authoritative Plex duration while opening its stream.
 * A fragmented MP4 only exposes the few seconds buffered by the browser, so
 * keep the session and durable progress record on that authoritative value
 * before the first heartbeat can decide a resume/completion boundary.
 */
export function updatePlaybackDuration(sessionId: string, durationMs: number): PlaybackProgress | null {
  const session = getPlaybackSession(sessionId);
  if (!session || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const progress = get(session.userId, session.ratingKey, session.mediaId);
  if (!progress) return null;
  const normalized = Math.round(durationMs);
  const boundary = completionBoundaryMs(normalized, getPlaybackMarkers(session.ratingKey), progress.mediaType);
  session.durationMs = normalized;
  progress.durationMs = normalized;
  progress.completionBoundaryMs = boundary.boundaryMs;
  progress.boundarySource = boundary.source;
  progress.updatedAt = Date.now();
  progress.revision++;
  persist();
  return progress;
}

export function applyHeartbeat(sessionId: string, input: { sequence: number; positionMs: number; isPlaying: boolean; playbackRate?: number; nowMs?: number }): PlaybackProgress {
  const session = getPlaybackSession(sessionId); if (!session) throw new Error("session_not_found");
  if (input.sequence <= session.lastSequence) return get(session.userId, session.ratingKey, session.mediaId)!;
  const now = input.nowMs ?? Date.now(); const elapsed = Math.max(0, now - session.lastHeartbeatAt);
  const plausible = isPlausiblePlaybackAdvance(session.lastPositionMs, input.positionMs, elapsed, input.playbackRate ?? 1);
  if (input.isPlaying && !session.seekPending && plausible) session.actualPlayedMs += Math.min(elapsed, 30_000);
  session.seekPending = false; session.lastSequence = input.sequence; session.lastHeartbeatAt = now; session.lastPositionMs = Math.max(0, input.positionMs);
  const p = get(session.userId, session.ratingKey, session.mediaId)!; p.actualPlayedMs += input.isPlaying && plausible ? Math.min(elapsed, 30_000) : 0; p.lastPositionMs = session.lastPositionMs; p.lastPlayedAt = now; p.updatedAt = now; p.revision++;
  if (!p.watched && p.actualPlayedMs >= MIN_REAL_PLAYBACK_MS) { p.eligibleForResume = true; if (p.lastPositionMs < (p.completionBoundaryMs ?? Number.MAX_SAFE_INTEGER)) p.resumeOffsetMs = p.lastPositionMs; }
  if (!p.watched && canComplete(p.actualPlayedMs, p.lastPositionMs, p.completionBoundaryMs)) markPlaybackWatched(p, p.boundarySource);
  persist(); return p;
}

export function applySeek(sessionId: string, positionMs: number): PlaybackProgress {
  const session = getPlaybackSession(sessionId); if (!session) throw new Error("session_not_found");
  session.seekPending = true; session.lastPositionMs = Math.max(0, positionMs); session.lastHeartbeatAt = Date.now();
  const p = get(session.userId, session.ratingKey, session.mediaId)!; p.lastPositionMs = session.lastPositionMs; p.updatedAt = Date.now(); p.revision++; persist(); return p;
}

export function applyMarkerSkip(sessionId: string, positionMs: number, markerType: string): PlaybackProgress {
  const session = getPlaybackSession(sessionId); if (!session) throw new Error("session_not_found");
  const fromPosition = session.lastPositionMs;
  const p = applySeek(sessionId, positionMs);
  if (!p.watched && markerType === "credits" && p.actualPlayedMs >= MIN_REAL_PLAYBACK_MS && p.completionBoundaryMs != null && fromPosition >= p.completionBoundaryMs) markPlaybackWatched(p, p.boundarySource);
  persist(); return p;
}

export function markPlaybackWatched(p: PlaybackProgress, source: CompletionBoundarySource = "ended"): PlaybackProgress {
  if (p.watched) return p;
  p.watched = true; p.watchedAt = Date.now(); p.resumeOffsetMs = null; p.eligibleForResume = false; p.boundarySource = source; p.updatedAt = Date.now(); p.revision++; p.plex.pendingAction = "scrobble";
  if (p.mediaType === "movie" && p.tmdbId != null) setWatchedMovies(p.userId, [p.tmdbId], true, p.title ?? "");
  if (p.mediaType === "episode" && p.tmdbId != null && p.seasonNumber != null && p.episodeNumber != null) setWatchedEpisodes(p.userId, [{ tmdbId: p.tmdbId, season: p.seasonNumber, episode: p.episodeNumber }], true, p.title ?? "");
  return p;
}
export function completePlayback(sessionId: string): PlaybackProgress { const s = getPlaybackSession(sessionId); if (!s) throw new Error("session_not_found"); const p = get(s.userId, s.ratingKey, s.mediaId)!; markPlaybackWatched(p); persist(); return p; }
export function stopPlayback(sessionId: string, positionMs?: number): PlaybackProgress { const s = getPlaybackSession(sessionId); if (!s) throw new Error("session_not_found"); const p = get(s.userId, s.ratingKey, s.mediaId)!; if (!p.watched && positionMs != null && p.eligibleForResume && positionMs < (p.completionBoundaryMs ?? Number.MAX_SAFE_INTEGER)) p.resumeOffsetMs = Math.max(0, positionMs); p.updatedAt = Date.now(); p.revision++; g.__movvizPlaybackSessions?.delete(sessionId); persist(); return p; }
