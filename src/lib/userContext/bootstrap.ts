import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listAllPlaybackProgress } from "@/lib/playback/progressStore";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getFeedback, getAllRatings } from "@/lib/ai/tasteProfile";
import { loadRequests } from "@/lib/requests/store";
import { withUserContextDb } from "./database";
import { recordUserContextEvent, syncPlaybackContext } from "./ingest";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LEGACY_SOURCE = "legacy_context_bootstrap_v1";

interface SyncRow {
  last_synced_at?: number | null;
}

function shouldRefresh(userId: string): boolean {
  return withUserContextDb((db) => {
    const row = db.prepare(
      "SELECT last_synced_at FROM context_sync_state WHERE source = ? AND user_id = ?"
    ).get(LEGACY_SOURCE, userId) as SyncRow | undefined;
    return !row?.last_synced_at || Date.now() - Number(row.last_synced_at) >= REFRESH_INTERVAL_MS;
  }, false);
}

function markRefresh(userId: string, error: string | null): void {
  withUserContextDb((db) => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO context_sync_state(source, user_id, cursor, last_synced_at, last_success_at, last_error)
      VALUES(?, ?, 'v1', ?, ?, ?)
      ON CONFLICT(source, user_id) DO UPDATE SET
        cursor = 'v1',
        last_synced_at = excluded.last_synced_at,
        last_success_at = CASE WHEN excluded.last_error IS NULL THEN excluded.last_success_at ELSE context_sync_state.last_success_at END,
        last_error = excluded.last_error
    `).run(LEGACY_SOURCE, userId, now, error ? null : now, error);
    return true;
  }, false);
}

function syncLegacyWatchedState(userId: string): void {
  const watch = getWatchStatus(userId);
  if (!watch) return;

  const movieRecentAt = new Map<number, number>();
  for (const recent of watch.recent ?? []) {
    if (recent.type === "movie") movieRecentAt.set(recent.tmdbId, recent.at);
    // Movies: same (source, sourceEventId) shape watchStore.ts now emits
    // LIVE on every setWatchedMovies() call — this backfill pass therefore
    // INSERT OR IGNOREs into a no-op for anything already recorded live
    // (any watch toggled since that wiring shipped), and only genuinely
    // fills in pre-existing history from before it existed. Series stay on
    // the legacy source/shape below: `recent` is one coarse per-series
    // entry with no episode coordinates, so it can never collide with the
    // precise per-episode events setWatchedEpisodes() emits live — both
    // are real, non-duplicate signal at different granularities.
    const isMovie = recent.type === "movie";
    recordUserContextEvent({
      userId,
      eventType: "watched_marked",
      source: isMovie ? "watch_store" : LEGACY_SOURCE,
      sourceEventId: isMovie
        ? `watch:${userId}:movie:${recent.tmdbId}:on:${recent.at}`
        : `recent:${userId}:${recent.type}:${recent.tmdbId}:${recent.at}`,
      tmdbId: recent.tmdbId,
      mediaType: recent.type,
      title: recent.title || null,
      occurredAt: recent.at,
      payload: { importedFrom: "plex-watch-status.json:recent" },
    });
  }

  withUserContextDb((db) => {
    const upsertMovie = db.prepare(`
      INSERT INTO user_media_state(
        state_key, user_id, tmdb_id, media_type, title_snapshot,
        progress_ratio, eligible_for_resume, watched, watched_at, updated_at
      ) VALUES(?, ?, ?, 'movie', ?, 1, 0, 1, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
        watched = 1,
        watched_at = COALESCE(user_media_state.watched_at, excluded.watched_at),
        updated_at = MAX(user_media_state.updated_at, excluded.updated_at)
    `);
    for (const tmdbId of watch.movies) {
      const watchedAt = movieRecentAt.get(tmdbId) ?? null;
      upsertMovie.run(
        `${userId}:movie:${tmdbId}`,
        userId,
        tmdbId,
        getMovieByTmdbId(tmdbId)?.title ?? null,
        watchedAt,
        watchedAt ?? watch.updatedAt,
      );
    }

    const upsertEpisode = db.prepare(`
      INSERT INTO user_media_state(
        state_key, user_id, tmdb_id, media_type, title_snapshot,
        season_number, episode_number, progress_ratio,
        eligible_for_resume, watched, watched_at, updated_at
      ) VALUES(?, ?, ?, 'episode', ?, ?, ?, 1, 0, 1, NULL, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        watched = 1,
        updated_at = MAX(user_media_state.updated_at, excluded.updated_at)
    `);
    for (const episode of watch.episodes) {
      upsertEpisode.run(
        `${userId}:episode:${episode.tmdbId}:${episode.season}:${episode.episode}`,
        userId,
        episode.tmdbId,
        getSeriesByTmdbId(episode.tmdbId)?.title ?? null,
        episode.season,
        episode.episode,
        watch.updatedAt,
      );
    }
    return true;
  }, false);
}

/**
 * Backfills 👍/👎 feedback, 1-5 star ratings, and requests into the ledger —
 * same idea as syncLegacyWatchedState above, and same trick: every
 * sourceEventId here is built with the EXACT (source, sourceEventId) shape
 * the live dual-write in tasteProfile.ts/requests/store.ts now uses, so this
 * pass is a genuine no-op (INSERT OR IGNORE) for anything already recorded
 * live, and only fills in whatever predates that wiring.
 */
function syncLegacyFeedbackRatingsRequests(userId: string): void {
  for (const entry of getFeedback(userId)) {
    recordUserContextEvent({
      userId,
      eventType: entry.liked ? "recommendation_liked" : "recommendation_disliked",
      source: "ai_feedback",
      sourceEventId: `feedback:${userId}:${entry.type}:${entry.tmdbId}:${entry.liked ? "like" : "dislike"}:${entry.at}`,
      tmdbId: entry.tmdbId,
      mediaType: entry.type,
      title: entry.title,
      textValue: entry.reason ?? null,
      occurredAt: entry.at,
    });
  }

  for (const rating of getAllRatings(userId)) {
    for (const h of rating.history) {
      recordUserContextEvent({
        userId,
        eventType: "rating_set",
        source: "ai_ratings",
        sourceEventId: `rating:${userId}:${rating.type}:${rating.tmdbId}:${h.source}:${h.at}`,
        tmdbId: rating.tmdbId,
        mediaType: rating.type,
        title: rating.title,
        numericValue: h.rating,
        textValue: h.source,
        occurredAt: h.at,
      });
    }
  }

  for (const request of loadRequests()) {
    if (request.userId !== userId) continue;
    recordUserContextEvent({
      userId,
      eventType: "media_requested",
      source: "requests_store",
      sourceEventId: `request:${request.id}`,
      tmdbId: request.tmdbId,
      mediaType: request.type,
      title: request.title,
      mediaId: request.id,
      occurredAt: request.createdAt,
    });
  }
}

/**
 * Lazily mirrors the legacy stores into the unified context database.
 *
 * It is deliberately best-effort and idempotent:
 * - `recent` entries keep their REAL timestamp;
 * - undated watched movie/episode flags stay undated (`watched_at = NULL`);
 * - playback-progress supplies exact progress/watchedAt when available;
 * - repeated refreshes never duplicate imported history events;
 * - failures never block chat or playback.
 */
export function refreshLegacyUserContext(userId: string, force = false): void {
  if (!force && !shouldRefresh(userId)) return;
  try {
    syncLegacyWatchedState(userId);
    syncLegacyFeedbackRatingsRequests(userId);
    for (const progress of listAllPlaybackProgress(userId)) {
      syncPlaybackContext(progress, { force: true });
    }
    markRefresh(userId, null);
  } catch (error) {
    markRefresh(userId, error instanceof Error ? error.message : String(error));
  }
}
