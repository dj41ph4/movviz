import { loadPlexConfig } from "./store";
import { setPlexWatched, deletePlexItem, getPlexOnDeck, type PlexOnDeckItem } from "./client";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { User } from "@/lib/auth/types";
import type { PlexServerConfig } from "./types";

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
export function resolveToken(user: User, cfg: { adminToken: string | null }): { token: string; managedUserId?: string } | null {
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

/**
 * Best-effort: asks Plex to delete its own reference to an item permanently
 * removed from Movviz's trash, so Plex's own library sync (syncMovieSection)
 * doesn't re-add it the next time it scans and still sees it. Never throws,
 * never blocks the caller's local deletion on failing.
 */
export async function deleteItemFromPlex(user: User, ratingKey: string): Promise<boolean> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return false;
  const auth = resolveToken(user, cfg);
  if (!auth) return false;
  const ok = await deletePlexItem(cfg, auth.token, ratingKey);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.trashDelete",
    `${user.username} — suppression Plex de ratingKey ${ratingKey} (corbeille vidée) : ${ok ? "ok" : "échec"}`
  );
  return ok;
}

/**
 * Continue Watching / on-deck data, verified before it's trusted for a
 * Plex Home managed profile. `resolveToken` gives those accounts the
 * shared admin token plus a bare `X-Plex-Profile` header — Plex never
 * actually authenticates that header for this endpoint, it's asserted, not
 * proven (unlike a genuinely distinct plexToken, which IS real Plex-side
 * scoping). watchSync.ts hit this exact class of bug for watched-status
 * ("GARDE ANTI-FUITE ENTRE PROFILS": Plex sometimes returns the SERVER
 * OWNER's own data instead of the requested profile's) and fixed it by
 * comparing fingerprints against the owner's own data — same fix here,
 * except compared against a fresh same-request owner fetch rather than a
 * stale cached one (a prior on-deck guard compared against watchSync's own
 * history, cached up to 2h — that dropped legitimately-just-started items
 * that hadn't reached the history log yet, and got reverted for it).
 */
export async function getVerifiedOnDeck(user: User, cfg: PlexServerConfig): Promise<PlexOnDeckItem[]> {
  const auth = resolveToken(user, cfg);
  if (!auth) return [];
  const items = await getPlexOnDeck(cfg, auth.token, auth.managedUserId);
  if (!auth.managedUserId) return items; // own distinct token — really is Plex-scoped, nothing to verify

  const ownerItems = await getPlexOnDeck(cfg, auth.token);
  const fingerprint = (list: PlexOnDeckItem[]) => list.map((i) => `${i.ratingKey}:${i.viewOffset}`).sort().join(",");
  if (items.length > 0 && fingerprint(items) === fingerprint(ownerItems)) {
    recordSearchLog(
      "warn",
      "plex.onDeckLeak",
      `${user.username} (profil géré ${auth.managedUserId}) : Plex a renvoyé le on-deck du propriétaire au lieu du sien — item(s) ignoré(s).`
    );
    return [];
  }
  return items;
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
