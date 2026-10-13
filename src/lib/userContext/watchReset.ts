import { withUserContextDb } from "./database";

/** Événements « visionnage » du journal : ce que « Effacer la lecture »
 *  retire. Notes, watchlist, recherches, faits IA et retours sur les
 *  recommandations restent : ce sont des goûts, pas du visionnage. */
export const WATCH_RESET_EVENT_TYPES = [
  "playback_started",
  "playback_resumed",
  "playback_stopped",
  "movie_completed",
  "episode_completed",
  "watched_marked",
  "watched_unmarked",
  "netflix_history_imported",
] as const;

export interface WatchContextResetResult {
  events: number;
  states: number;
}

/**
 * Remet à zéro le visionnage canonique d'UN profil (requêtes toutes bornées
 * par user_id) : historique de lecture effacé, chaque titre repasse « non vu »
 * sans reprise. L'état devient une décision explicite « non vu » datée de la
 * remise à zéro (pas « inconnu ») : une resynchro plus ancienne perd donc au
 * résolveur, en plus du garde-fou de date (lib/watch/resetFloor.ts). Les
 * exports Plex encore en attente pour ce profil sont abandonnés : ils
 * repousseraient d'anciens « vu » vers Plex.
 */
export function resetWatchContextForUser(userId: string, resetAt: number): WatchContextResetResult | null {
  return withUserContextDb((db) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const placeholders = WATCH_RESET_EVENT_TYPES.map(() => "?").join(", ");
      const events = db.prepare(
        `DELETE FROM context_events WHERE user_id = ? AND event_type IN (${placeholders})`,
      ).run(userId, ...WATCH_RESET_EVENT_TYPES).changes;
      const states = db.prepare(`
        UPDATE user_media_state SET
          watched = 0,
          watched_at = NULL,
          watched_updated_at = ?,
          watched_source = 'movviz_manual',
          watched_event_id = 'watch-reset:' || user_id || ':' || ?,
          watched_revision = COALESCE(watched_revision, 0) + 1,
          position_ms = NULL,
          duration_ms = NULL,
          progress_ratio = NULL,
          eligible_for_resume = 0,
          started_at = NULL,
          last_played_at = NULL,
          progress_updated_at = ?,
          progress_source = 'watch_reset',
          updated_at = ?
        WHERE user_id = ?
      `).run(resetAt, resetAt, resetAt, resetAt, userId).changes;
      db.prepare(
        "DELETE FROM user_media_sync_state WHERE user_id = ? AND target = 'plex' AND field = 'watched'",
      ).run(userId);
      db.exec("COMMIT");
      return { events: Number(events), states: Number(states) };
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* best-effort */ }
      throw error;
    }
  }, null);
}
