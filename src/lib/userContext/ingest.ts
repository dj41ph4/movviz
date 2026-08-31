import { randomUUID } from "node:crypto";
import { withUserContextDb } from "./database";
import type { ContextMediaState, UserContextEvent } from "./types";

const g = globalThis as typeof globalThis & {
  __movvizUserContextProjectionThrottle?: Map<string, { at: number; positionMs: number; watched: boolean }>;
};

const THROTTLE_MS = 60_000;
const POSITION_DELTA_MS = 30_000;

function projectionThrottle(): Map<string, { at: number; positionMs: number; watched: boolean }> {
  return (g.__movvizUserContextProjectionThrottle ??= new Map());
}

function stateKey(state: Pick<ContextMediaState, "userId" | "mediaType" | "tmdbId" | "seasonNumber" | "episodeNumber">): string {
  if (state.mediaType === "episode") {
    return `${state.userId}:episode:${state.tmdbId}:${state.seasonNumber ?? -1}:${state.episodeNumber ?? -1}`;
  }
  return `${state.userId}:${state.mediaType}:${state.tmdbId}`;
}

export function recordUserContextEvent(event: UserContextEvent): boolean {
  return withUserContextDb((db) => {
    const result = db.prepare(`
      INSERT OR IGNORE INTO context_events(
        id, user_id, event_type, source, tmdb_id, media_type,
        season_number, episode_number, media_id, rating_key, title_snapshot,
        position_ms, duration_ms, numeric_value, text_value,
        occurred_at, recorded_at, source_event_id, payload_json
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id ?? randomUUID(),
      event.userId,
      event.eventType,
      event.source,
      event.tmdbId ?? null,
      event.mediaType ?? null,
      event.seasonNumber ?? null,
      event.episodeNumber ?? null,
      event.mediaId ?? null,
      event.ratingKey ?? null,
      event.title ?? null,
      event.positionMs ?? null,
      event.durationMs ?? null,
      event.numericValue ?? null,
      event.textValue ?? null,
      event.occurredAt,
      Date.now(),
      event.sourceEventId ?? null,
      event.payload ? JSON.stringify(event.payload) : null,
    );
    return Number(result.changes) > 0;
  }, false);
}

export function upsertUserMediaState(input: Omit<ContextMediaState, "stateKey"> & { stateKey?: string }, options?: { force?: boolean }): boolean {
  const key = input.stateKey ?? stateKey(input);
  const now = Date.now();
  const positionMs = Math.max(0, input.positionMs ?? 0);
  const previous = projectionThrottle().get(`${input.userId}:${key}`);
  const shouldWrite = options?.force || !previous || previous.watched !== input.watched ||
    Math.abs(positionMs - previous.positionMs) >= POSITION_DELTA_MS || now - previous.at >= THROTTLE_MS;

  if (!shouldWrite) return false;

  const written = withUserContextDb((db) => {
    db.prepare(`
      INSERT INTO user_media_state(
        state_key, user_id, tmdb_id, media_type, media_id, rating_key, title_snapshot,
        season_number, episode_number, position_ms, duration_ms, progress_ratio,
        eligible_for_resume, watched, started_at, last_played_at, watched_at,
        updated_at, source_revision
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        user_id = excluded.user_id,
        tmdb_id = excluded.tmdb_id,
        media_type = excluded.media_type,
        media_id = COALESCE(excluded.media_id, user_media_state.media_id),
        rating_key = COALESCE(excluded.rating_key, user_media_state.rating_key),
        title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
        season_number = COALESCE(excluded.season_number, user_media_state.season_number),
        episode_number = COALESCE(excluded.episode_number, user_media_state.episode_number),
        position_ms = COALESCE(excluded.position_ms, user_media_state.position_ms),
        duration_ms = COALESCE(excluded.duration_ms, user_media_state.duration_ms),
        progress_ratio = COALESCE(excluded.progress_ratio, user_media_state.progress_ratio),
        eligible_for_resume = excluded.eligible_for_resume,
        watched = excluded.watched,
        started_at = COALESCE(user_media_state.started_at, excluded.started_at),
        last_played_at = COALESCE(excluded.last_played_at, user_media_state.last_played_at),
        watched_at = excluded.watched_at,
        updated_at = excluded.updated_at,
        source_revision = COALESCE(excluded.source_revision, user_media_state.source_revision)
    `).run(
      key,
      input.userId,
      input.tmdbId,
      input.mediaType,
      input.mediaId ?? null,
      input.ratingKey ?? null,
      input.title ?? null,
      input.seasonNumber ?? null,
      input.episodeNumber ?? null,
      input.positionMs ?? null,
      input.durationMs ?? null,
      input.progressRatio ?? null,
      input.eligibleForResume ? 1 : 0,
      input.watched ? 1 : 0,
      input.startedAt ?? null,
      input.lastPlayedAt ?? null,
      input.watchedAt ?? null,
      input.updatedAt,
      input.sourceRevision ?? null,
    );
    return true;
  }, false);

  if (written) projectionThrottle().set(`${input.userId}:${key}`, { at: now, positionMs, watched: input.watched });
  return written;
}

export interface PlaybackContextSnapshot {
  userId: string;
  mediaId?: string;
  ratingKey: string;
  mediaType: "movie" | "episode";
  tmdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  title?: string;
  durationMs: number;
  resumeOffsetMs: number | null;
  eligibleForResume: boolean;
  watched: boolean;
  watchedAt: number | null;
  lastPositionMs: number;
  lastPlayedAt: number | null;
  updatedAt: number;
  revision: number;
}

export function syncPlaybackContext(snapshot: PlaybackContextSnapshot, options?: { force?: boolean; startedAt?: number | null }): boolean {
  if (snapshot.tmdbId == null) return false;
  const duration = Math.max(0, snapshot.durationMs || 0);
  const position = Math.max(0, snapshot.lastPositionMs || snapshot.resumeOffsetMs || 0);
  const ratio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : null;
  return upsertUserMediaState({
    userId: snapshot.userId,
    tmdbId: snapshot.tmdbId,
    mediaType: snapshot.mediaType,
    mediaId: snapshot.mediaId ?? null,
    ratingKey: snapshot.ratingKey,
    title: snapshot.title ?? null,
    seasonNumber: snapshot.seasonNumber ?? null,
    episodeNumber: snapshot.episodeNumber ?? null,
    positionMs: position,
    durationMs: duration || null,
    progressRatio: ratio,
    eligibleForResume: snapshot.eligibleForResume,
    watched: snapshot.watched,
    startedAt: options?.startedAt ?? null,
    lastPlayedAt: snapshot.lastPlayedAt,
    watchedAt: snapshot.watchedAt,
    updatedAt: snapshot.updatedAt,
    sourceRevision: snapshot.revision,
  }, options);
}

export function recordPlaybackStarted(sessionId: string, snapshot: PlaybackContextSnapshot, startedAt: number): void {
  syncPlaybackContext(snapshot, { force: true, startedAt });
  recordUserContextEvent({
    userId: snapshot.userId,
    eventType: snapshot.resumeOffsetMs && snapshot.resumeOffsetMs > 0 ? "playback_resumed" : "playback_started",
    source: "movviz_playback",
    sourceEventId: `session:${sessionId}:start`,
    tmdbId: snapshot.tmdbId ?? null,
    mediaType: snapshot.mediaType,
    seasonNumber: snapshot.seasonNumber ?? null,
    episodeNumber: snapshot.episodeNumber ?? null,
    mediaId: snapshot.mediaId ?? null,
    ratingKey: snapshot.ratingKey,
    title: snapshot.title ?? null,
    positionMs: snapshot.resumeOffsetMs ?? 0,
    durationMs: snapshot.durationMs,
    occurredAt: startedAt,
  });
}

export function recordPlaybackStopped(sessionId: string, snapshot: PlaybackContextSnapshot, occurredAt = Date.now()): void {
  syncPlaybackContext(snapshot, { force: true });
  recordUserContextEvent({
    userId: snapshot.userId,
    eventType: "playback_stopped",
    source: "movviz_playback",
    sourceEventId: `session:${sessionId}:stop`,
    tmdbId: snapshot.tmdbId ?? null,
    mediaType: snapshot.mediaType,
    seasonNumber: snapshot.seasonNumber ?? null,
    episodeNumber: snapshot.episodeNumber ?? null,
    mediaId: snapshot.mediaId ?? null,
    ratingKey: snapshot.ratingKey,
    title: snapshot.title ?? null,
    positionMs: snapshot.lastPositionMs,
    durationMs: snapshot.durationMs,
    occurredAt,
  });
}

export function recordPlaybackCompleted(snapshot: PlaybackContextSnapshot): void {
  const occurredAt = snapshot.watchedAt ?? Date.now();
  syncPlaybackContext(snapshot, { force: true });
  recordUserContextEvent({
    userId: snapshot.userId,
    eventType: snapshot.mediaType === "movie" ? "movie_completed" : "episode_completed",
    source: "movviz_playback",
    sourceEventId: `complete:${snapshot.userId}:${snapshot.mediaId ?? snapshot.ratingKey}:${occurredAt}`,
    tmdbId: snapshot.tmdbId ?? null,
    mediaType: snapshot.mediaType,
    seasonNumber: snapshot.seasonNumber ?? null,
    episodeNumber: snapshot.episodeNumber ?? null,
    mediaId: snapshot.mediaId ?? null,
    ratingKey: snapshot.ratingKey,
    title: snapshot.title ?? null,
    positionMs: snapshot.lastPositionMs,
    durationMs: snapshot.durationMs,
    occurredAt,
  });
}
