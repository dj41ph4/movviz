import { withUserContextDb } from "./database";

function movieStateKey(userId: string, tmdbId: number): string {
  return `${userId}:movie:${tmdbId}`;
}

function episodeStateKey(userId: string, tmdbId: number, season: number, episode: number): string {
  return `${userId}:episode:${tmdbId}:${season}:${episode}`;
}

export function syncWatchedMovieState(input: {
  userId: string;
  tmdbId: number;
  title?: string;
  watched: boolean;
  at?: number;
}): void {
  const now = input.at ?? Date.now();
  withUserContextDb((db) => {
    if (input.watched) {
      db.prepare(`
        INSERT INTO user_media_state(
          state_key, user_id, tmdb_id, media_type, title_snapshot,
          progress_ratio, eligible_for_resume, watched, watched_at, updated_at, watched_updated_at, watched_source
        ) VALUES(?, ?, ?, 'movie', ?, 1, 0, 1, ?, ?, ?, 'watch_store')
        ON CONFLICT(state_key) DO UPDATE SET
          title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
          progress_ratio = 1,
          eligible_for_resume = 0,
          watched = 1,
          watched_at = excluded.watched_at,
          updated_at = excluded.updated_at,
          watched_updated_at = excluded.watched_updated_at,
          watched_source = excluded.watched_source
      `).run(movieStateKey(input.userId, input.tmdbId), input.userId, input.tmdbId, input.title ?? null, now, now, now);
    } else {
      db.prepare(`
        INSERT INTO user_media_state(
          state_key, user_id, tmdb_id, media_type, title_snapshot,
          eligible_for_resume, watched, watched_at, updated_at, watched_updated_at, watched_source
        ) VALUES(?, ?, ?, 'movie', ?, 0, 0, NULL, ?, ?, 'watch_store')
        ON CONFLICT(state_key) DO UPDATE SET
          title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
          watched = 0,
          watched_at = NULL,
          updated_at = excluded.updated_at,
          watched_updated_at = excluded.watched_updated_at,
          watched_source = excluded.watched_source
      `).run(movieStateKey(input.userId, input.tmdbId), input.userId, input.tmdbId, input.title ?? null, now, now);
    }
    return true;
  }, false);
}

export function syncWatchedEpisodeState(input: {
  userId: string;
  tmdbId: number;
  season: number;
  episode: number;
  title?: string;
  watched: boolean;
  at?: number;
}): void {
  const now = input.at ?? Date.now();
  const key = episodeStateKey(input.userId, input.tmdbId, input.season, input.episode);
  withUserContextDb((db) => {
    if (input.watched) {
      db.prepare(`
        INSERT INTO user_media_state(
          state_key, user_id, tmdb_id, media_type, title_snapshot,
          season_number, episode_number, progress_ratio,
          eligible_for_resume, watched, watched_at, updated_at, watched_updated_at, watched_source
        ) VALUES(?, ?, ?, 'episode', ?, ?, ?, 1, 0, 1, ?, ?, ?, 'watch_store')
        ON CONFLICT(state_key) DO UPDATE SET
          title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
          season_number = excluded.season_number,
          episode_number = excluded.episode_number,
          progress_ratio = 1,
          eligible_for_resume = 0,
          watched = 1,
          watched_at = excluded.watched_at,
          updated_at = excluded.updated_at,
          watched_updated_at = excluded.watched_updated_at,
          watched_source = excluded.watched_source
      `).run(key, input.userId, input.tmdbId, input.title ?? null, input.season, input.episode, now, now, now);
    } else {
      db.prepare(`
        INSERT INTO user_media_state(
          state_key, user_id, tmdb_id, media_type, title_snapshot,
          season_number, episode_number, eligible_for_resume,
          watched, watched_at, updated_at, watched_updated_at, watched_source
        ) VALUES(?, ?, ?, 'episode', ?, ?, ?, 0, 0, NULL, ?, ?, 'watch_store')
        ON CONFLICT(state_key) DO UPDATE SET
          title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
          season_number = excluded.season_number,
          episode_number = excluded.episode_number,
          watched = 0,
          watched_at = NULL,
          updated_at = excluded.updated_at,
          watched_updated_at = excluded.watched_updated_at,
          watched_source = excluded.watched_source
      `).run(key, input.userId, input.tmdbId, input.title ?? null, input.season, input.episode, now, now);
    }
    return true;
  }, false);
}
