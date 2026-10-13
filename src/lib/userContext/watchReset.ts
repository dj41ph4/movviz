import { withUserContextDb } from "./database";

export interface WatchContextResetResult {
  events: number;
  states: number;
  preferences: number;
}

/**
 * « Effacer la lecture » (profil vierge) : remet à zéro tout le contexte
 * canonique d'UN profil (requêtes toutes bornées par user_id). Le journal
 * (lectures, vues, notes, liste, recherches, retours IA) et les préférences
 * apprises sont supprimés. Chaque titre connu repasse « non vu », sans
 * reprise, sans note et hors de la liste : ce sont des décisions explicites
 * datées de la remise à zéro (pas « inconnu »), pour qu'une resynchro plus
 * ancienne perde au résolveur, en plus du garde-fou de date
 * (lib/watch/resetFloor.ts). Les exports Plex encore en attente pour ce
 * profil sont abandonnés : ils repousseraient l'ancien état vers Plex.
 */
export function resetWatchContextForUser(userId: string, resetAt: number): WatchContextResetResult | null {
  return withUserContextDb((db) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const events = db.prepare("DELETE FROM context_events WHERE user_id = ?").run(userId).changes;
      const preferences = db.prepare("DELETE FROM user_preferences WHERE user_id = ?").run(userId).changes;
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
          rating_value = NULL,
          rating_updated_at = ?,
          rating_source = 'watch_reset',
          watchlist_present = 0,
          watchlist_updated_at = ?,
          watchlist_source = 'watch_reset',
          watchlist_removed_at = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(resetAt, resetAt, resetAt, resetAt, resetAt, resetAt, resetAt, userId).changes;
      db.prepare("DELETE FROM user_media_sync_state WHERE user_id = ? AND target = 'plex'").run(userId);
      db.exec("COMMIT");
      return { events: Number(events), states: Number(states), preferences: Number(preferences) };
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* best-effort */ }
      throw error;
    }
  }, null);
}
