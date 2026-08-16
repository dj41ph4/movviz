import { loadPlexConfig } from "./store";
import { setPlexWatched } from "./client";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { User } from "@/lib/auth/types";

/**
 * Movviz → Plex (demande explicite user — "bidirectionnel"). Push a
 * watched/unwatched change made IN MOVVIZ (manual toggle, or a future
 * Netflix import) out to this Movviz user's own Plex account, using
 * client.ts's setPlexWatched (real scrobble/unscrobble API).
 *
 * Only ever called from the WRITE paths a user (or an import) actually
 * triggers (watch/toggle route) — never from watchSync.ts's own Plex→Movviz
 * read, which is what keeps this one-directional-per-event instead of an
 * infinite mirror: a status Movviz just learned FROM Plex is never pushed
 * BACK to Plex, only a status Movviz itself just changed.
 *
 * No-op, silently, when: Plex isn't configured, this Movviz user never
 * linked a Plex account, or the item hasn't been through a Plex library
 * sync yet (no known ratingKey) — never blocks or breaks the local toggle
 * either way (callers fire-and-forget this).
 */
function resolveToken(user: User, cfg: { adminToken: string | null }): { token: string; managedUserId?: string } | null {
  if (user.plexToken) return { token: user.plexToken };
  if (user.plexManagedUserId && cfg.adminToken) return { token: cfg.adminToken, managedUserId: user.plexManagedUserId };
  return null;
}

export async function pushMovieWatchedToPlex(user: User, tmdbId: number, watched: boolean): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = resolveToken(user, cfg);
  if (!auth) return;
  const movie = getMovieByTmdbId(tmdbId);
  if (!movie?.plexRatingKey) return;

  const ok = await setPlexWatched(cfg, auth.token, movie.plexRatingKey, watched, auth.managedUserId);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.watchWrite",
    `${user.username} (plexId:${user.plexId ?? "?"}${auth.managedUserId ? `, managed:${auth.managedUserId}` : ""}) — « ${movie.title} » ${watched ? "marqué vu" : "marqué non vu"} sur Plex : ${ok ? "ok" : "échec"}`
  );
}

export async function pushEpisodesWatchedToPlex(
  user: User,
  entries: { tmdbId: number; season: number; episode: number }[],
  watched: boolean
): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = resolveToken(user, cfg);
  if (!auth) return;

  const bySeries = new Map<number, { season: number; episode: number }[]>();
  for (const e of entries) {
    const list = bySeries.get(e.tmdbId) ?? [];
    list.push(e);
    bySeries.set(e.tmdbId, list);
  }

  for (const [tmdbId, eps] of bySeries) {
    const series = getSeriesByTmdbId(tmdbId);
    if (!series) continue;
    let ok = 0;
    let fail = 0;
    for (const e of eps) {
      const season = series.seasons.find((s) => s.seasonNumber === e.season);
      const episode = season?.episodes.find((ep) => ep.episodeNumber === e.episode);
      if (!episode?.plexRatingKey) {
        fail++;
        continue;
      }
      const result = await setPlexWatched(cfg, auth.token, episode.plexRatingKey, watched, auth.managedUserId);
      if (result) ok++;
      else fail++;
    }
    recordSearchLog(
      fail === 0 ? "info" : "warn",
      "plex.watchWrite",
      `${user.username} (plexId:${user.plexId ?? "?"}${auth.managedUserId ? `, managed:${auth.managedUserId}` : ""}) — « ${series.title} » : ${ok} épisode(s) ${watched ? "marqué(s) vu(s)" : "marqué(s) non vu(s)"} sur Plex, ${fail} échec(s)/pas encore synchronisable(s)`
    );
  }
}
