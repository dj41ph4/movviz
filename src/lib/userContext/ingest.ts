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
        updated_at, source_revision, progress_updated_at, progress_source,
        watched_updated_at, watched_source, rating_value, rating_updated_at,
        rating_source, watchlist_present, watchlist_updated_at, watchlist_source,
        watchlist_added_at, watchlist_removed_at, plex_guid, plex_discover_rating_key
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        user_id = excluded.user_id,
        tmdb_id = excluded.tmdb_id,
        media_type = excluded.media_type,
        media_id = COALESCE(excluded.media_id, user_media_state.media_id),
        rating_key = COALESCE(excluded.rating_key, user_media_state.rating_key),
        title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
        season_number = COALESCE(excluded.season_number, user_media_state.season_number),
        episode_number = COALESCE(excluded.episode_number, user_media_state.episode_number),
        position_ms = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at OR (excluded.progress_updated_at = user_media_state.progress_updated_at AND COALESCE(excluded.progress_source, '') > COALESCE(user_media_state.progress_source, ''))) THEN excluded.position_ms ELSE user_media_state.position_ms END,
        duration_ms = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at OR (excluded.progress_updated_at = user_media_state.progress_updated_at AND COALESCE(excluded.progress_source, '') > COALESCE(user_media_state.progress_source, ''))) THEN excluded.duration_ms ELSE user_media_state.duration_ms END,
        progress_ratio = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at OR (excluded.progress_updated_at = user_media_state.progress_updated_at AND COALESCE(excluded.progress_source, '') > COALESCE(user_media_state.progress_source, ''))) THEN excluded.progress_ratio ELSE user_media_state.progress_ratio END,
        eligible_for_resume = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at OR (excluded.progress_updated_at = user_media_state.progress_updated_at AND COALESCE(excluded.progress_source, '') > COALESCE(user_media_state.progress_source, ''))) THEN excluded.eligible_for_resume ELSE user_media_state.eligible_for_resume END,
        watched = CASE WHEN excluded.watched_updated_at IS NOT NULL AND (user_media_state.watched_updated_at IS NULL OR excluded.watched_updated_at > user_media_state.watched_updated_at OR (excluded.watched_updated_at = user_media_state.watched_updated_at AND COALESCE(excluded.watched_source, '') > COALESCE(user_media_state.watched_source, ''))) THEN excluded.watched ELSE user_media_state.watched END,
        started_at = COALESCE(user_media_state.started_at, excluded.started_at),
        last_played_at = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at OR (excluded.progress_updated_at = user_media_state.progress_updated_at AND COALESCE(excluded.progress_source, '') > COALESCE(user_media_state.progress_source, ''))) THEN excluded.last_played_at ELSE user_media_state.last_played_at END,
        watched_at = CASE WHEN excluded.watched_updated_at IS NOT NULL AND (user_media_state.watched_updated_at IS NULL OR excluded.watched_updated_at > user_media_state.watched_updated_at OR (excluded.watched_updated_at = user_media_state.watched_updated_at AND COALESCE(excluded.watched_source, '') > COALESCE(user_media_state.watched_source, ''))) THEN excluded.watched_at ELSE user_media_state.watched_at END,
        updated_at = MAX(excluded.updated_at, COALESCE(user_media_state.updated_at, 0)),
        source_revision = COALESCE(excluded.source_revision, user_media_state.source_revision),
        progress_updated_at = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at) THEN excluded.progress_updated_at ELSE user_media_state.progress_updated_at END,
        progress_source = CASE WHEN excluded.progress_updated_at IS NOT NULL AND (user_media_state.progress_updated_at IS NULL OR excluded.progress_updated_at > user_media_state.progress_updated_at) THEN excluded.progress_source ELSE user_media_state.progress_source END,
        watched_updated_at = CASE WHEN excluded.watched_updated_at IS NOT NULL AND (user_media_state.watched_updated_at IS NULL OR excluded.watched_updated_at > user_media_state.watched_updated_at) THEN excluded.watched_updated_at ELSE user_media_state.watched_updated_at END,
        watched_source = CASE WHEN excluded.watched_updated_at IS NOT NULL AND (user_media_state.watched_updated_at IS NULL OR excluded.watched_updated_at > user_media_state.watched_updated_at) THEN excluded.watched_updated_at ELSE user_media_state.watched_source END,
        rating_value = CASE WHEN excluded.rating_updated_at IS NOT NULL AND (user_media_state.rating_updated_at IS NULL OR excluded.rating_updated_at > user_media_state.rating_updated_at) THEN excluded.rating_value ELSE user_media_state.rating_value END,
        rating_updated_at = CASE WHEN excluded.rating_updated_at IS NOT NULL AND (user_media_state.rating_updated_at IS NULL OR excluded.rating_updated_at > user_media_state.rating_updated_at) THEN excluded.rating_updated_at ELSE user_media_state.rating_updated_at END,
        rating_source = CASE WHEN excluded.rating_updated_at IS NOT NULL AND (user_media_state.rating_updated_at IS NULL OR excluded.rating_updated_at > user_media_state.rating_updated_at) THEN excluded.rating_source ELSE user_media_state.rating_source END,
        watchlist_present = CASE WHEN excluded.watchlist_updated_at IS NOT NULL AND (user_media_state.watchlist_updated_at IS NULL OR excluded.watchlist_updated_at > user_media_state.watchlist_updated_at) THEN excluded.watchlist_present ELSE user_media_state.watchlist_present END,
        watchlist_updated_at = CASE WHEN excluded.watchlist_updated_at IS NOT NULL AND (user_media_state.watchlist_updated_at IS NULL OR excluded.watchlist_updated_at > user_media_state.watchlist_updated_at) THEN excluded.watchlist_updated_at ELSE user_media_state.watchlist_updated_at END,
        watchlist_source = CASE WHEN excluded.watchlist_updated_at IS NOT NULL AND (user_media_state.watchlist_updated_at IS NULL OR excluded.watchlist_updated_at > user_media_state.watchlist_updated_at) THEN excluded.watchlist_source ELSE user_media_state.watchlist_source END,
        watchlist_added_at = CASE WHEN excluded.watchlist_updated_at IS NOT NULL AND (user_media_state.watchlist_updated_at IS NULL OR excluded.watchlist_updated_at > user_media_state.watchlist_updated_at) THEN excluded.watchlist_added_at ELSE user_media_state.watchlist_added_at END,
        watchlist_removed_at = CASE WHEN excluded.watchlist_updated_at IS NOT NULL AND (user_media_state.watchlist_updated_at IS NULL OR excluded.watchlist_updated_at > user_media_state.watchlist_updated_at) THEN excluded.watchlist_removed_at ELSE user_media_state.watchlist_removed_at END,
        plex_guid = COALESCE(excluded.plex_guid, user_media_state.plex_guid),
        plex_discover_rating_key = COALESCE(excluded.plex_discover_rating_key, user_media_state.plex_discover_rating_key)
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
      input.progressUpdatedAt ?? null,
      input.progressSource ?? null,
      input.watchedUpdatedAt ?? null,
      input.watchedSource ?? null,
      input.ratingValue ?? null,
      input.ratingUpdatedAt ?? null,
      input.ratingSource ?? null,
      input.watchlistPresent == null ? null : (input.watchlistPresent ? 1 : 0),
      input.watchlistUpdatedAt ?? null,
      input.watchlistSource ?? null,
      input.watchlistAddedAt ?? null,
      input.watchlistRemovedAt ?? null,
      input.plexGuid ?? null,
      input.plexDiscoverRatingKey ?? null,
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
    progressUpdatedAt: snapshot.updatedAt,
    progressSource: "movviz_playback",
    watchedUpdatedAt: snapshot.watchedAt,
    watchedSource: snapshot.watchedAt == null ? null : "movviz_playback",
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
