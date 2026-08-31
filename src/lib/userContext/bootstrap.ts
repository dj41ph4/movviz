import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listAllPlaybackProgress } from "@/lib/playback/progressStore";
import { getWatchStatus } from "@/lib/plex/watchStore";
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
    recordUserContextEvent({
      userId,
      eventType: "watched_marked",
      source: LEGACY_SOURCE,
      sourceEventId: `recent:${userId}:${recent.type}:${recent.tmdbId}:${recent.at}`,
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
    for (const progress of listAllPlaybackProgress(userId)) {
      syncPlaybackContext(progress, { force: true });
    }
    markRefresh(userId, null);
  } catch (error) {
    markRefresh(userId, error instanceof Error ? error.message : String(error));
  }
}
