import { loadPlexConfig, savePlexConfig } from "./store";
import { setPlexWatched, setPlexRating, deletePlexItem, getPlexOnDeck, getPlexServerAccessToken, getServerIdentity, switchPlexHomeUser, removePlexFromContinueWatching, type PlexOnDeckItem } from "./client";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { User } from "@/lib/auth/types";
import type { PlexServerConfig } from "./types";
import { updateUser } from "@/lib/auth/store";

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
export function resolveToken(user: User, cfg: { adminToken: string | null }): { token: string } | null {
  // Never fall back to an account token or `X-Plex-Profile` here.  Those
  // credentials are not a reliable PMS identity and were the source of the
  // cross-profile history/resume leak.  Calls that can await use
  // `resolvePlexServerAuth`, which exchanges the account token for the real
  // server-scoped token first.
  if (user.plexServerToken) return { token: user.plexServerToken };
  if (user.role === "admin" && user.plexToken && user.plexToken === cfg.adminToken) return { token: user.plexToken };
  return null;
}

export interface PlexServerAuth {
  token: string;
  source: "owner" | "account" | "managed";
}

function isOwnerAccount(user: User, cfg: PlexServerConfig) {
  return user.role === "admin" && !!cfg.adminToken && user.plexToken === cfg.adminToken;
}

async function ensureMachineIdentifier(cfg: PlexServerConfig): Promise<string | null> {
  if (cfg.machineIdentifier) return cfg.machineIdentifier;
  const machineIdentifier = await getServerIdentity(cfg);
  if (!machineIdentifier) return null;
  savePlexConfig({ ...cfg, machineIdentifier });
  return machineIdentifier;
}

/**
 * Obtain an actual PMS credential for this Movviz user.  Plex account tokens
 * identify a plex.tv session, not necessarily a media-server profile; Home
 * profiles additionally require `/home/users/{id}/switch`, then a resources
 * exchange for this specific server.  Persisting only the resulting
 * server-scoped token avoids an extra plex.tv round-trip on every card row.
 */
export async function resolvePlexServerAuth(user: User, cfg: PlexServerConfig): Promise<PlexServerAuth | null> {
  if (!cfg.hostname) return null;
  if (isOwnerAccount(user, cfg) && cfg.adminToken) return { token: cfg.adminToken, source: "owner" };
  if (user.plexServerToken) return { token: user.plexServerToken, source: user.plexManagedUserId ? "managed" : "account" };
  if (!cfg.adminToken) return null;

  const machineIdentifier = await ensureMachineIdentifier(cfg);
  if (!machineIdentifier) return null;

  let accountToken = user.plexToken;
  let source: PlexServerAuth["source"] = "account";
  if (!accountToken && user.plexManagedUserId) {
    accountToken = await switchPlexHomeUser(cfg.clientId, cfg.adminToken, user.plexManagedUserId);
    source = "managed";
  }
  if (!accountToken) return null;

  const serverToken = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
  if (!serverToken) {
    recordSearchLog(
      "warn",
      "plex.profileAuth",
      `${user.username}: Plex n'a pas fourni de jeton d'accès pour ce serveur — données Plex personnelles ignorées, données Movviz locales conservées.`
    );
    return null;
  }
  updateUser(user.id, { plexServerToken: serverToken });
  return { token: serverToken, source };
}

export async function pushMovieWatchedToPlex(user: User, tmdbId: number, watched: boolean): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return;
  const movie = getMovieByTmdbId(tmdbId);
  if (!movie?.plexRatingKey) return;

  const ok = await setPlexWatched(cfg, auth.token, movie.plexRatingKey, watched);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.watchWrite",
    `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${movie.title} » ${watched ? "marqué vu" : "marqué non vu"} sur Plex : ${ok ? "ok" : "échec"}`
  );
}

export async function pushRatingToPlex(user: User, tmdbId: number, type: "movie" | "series", stars: number | null, at?: number): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return;
  const media = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  if (!media?.plexRatingKey) return;
  const ok = await setPlexRating(cfg, auth.token, media.plexRatingKey, stars == null ? 0 : stars * 2, at);
  recordSearchLog(ok ? "info" : "warn", "plex.ratingSync", `${user.username} — « ${media.title} » rating ${stars == null ? "effacé" : `${stars}/5`} sur Plex : ${ok ? "ok" : "échec"}`);
}

/** "Retirer de la liste Reprendre" (Reprendre row's own dropdown, confirmed
 *  live) — Plex's real removeFromContinueWatching action, distinct from
 *  scrobbling: drops the item off On Deck without marking it watched, so a
 *  later real play starts over instead of resuming or counting as a rewatch. */
export async function removeFromContinueWatchingOnPlex(user: User, ratingKey: string): Promise<boolean> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return false;
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return false;
  const ok = await removePlexFromContinueWatching(cfg, auth.token, ratingKey);
  recordSearchLog(
    ok ? "info" : "warn",
    "plex.watchWrite",
    `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — retrait de "Continuer à regarder" (ratingKey:${ratingKey}) sur Plex : ${ok ? "ok" : "échec"}`
  );
  return ok;
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
  const auth = await resolvePlexServerAuth(user, cfg);
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
 * Continue Watching / on-deck data, always read through a real PMS token.
 * A second, per-item comparison against the owner's On Deck is retained as a
 * fail-closed guard for an expired/broken scoped token: Plex must never turn
 * the server owner's position into another Movviz user's resume position.
 */
export async function getVerifiedOnDeck(user: User, cfg: PlexServerConfig): Promise<PlexOnDeckItem[]> {
  const auth = await resolvePlexServerAuth(user, cfg);
  if (!auth) return [];
  const items = await getPlexOnDeck(cfg, auth.token);
  if (auth.source === "owner" || !cfg.adminToken) return items;

  const ownerItems = await getPlexOnDeck(cfg, cfg.adminToken);
  const ownerPositions = new Set(ownerItems.map((i) => `${i.ratingKey}:${i.viewOffset}:${i.duration}`));
  const verified = items.filter((i) => !ownerPositions.has(`${i.ratingKey}:${i.viewOffset}:${i.duration}`));
  if (verified.length !== items.length) {
    recordSearchLog(
      "warn",
      "plex.onDeckLeak",
      `${user.username} (${auth.source}) : ${items.length - verified.length} position(s) identique(s) au compte propriétaire rejetée(s) — reprise Movviz locale conservée.`
    );
  }
  return verified;
}

export async function pushEpisodesWatchedToPlex(
  user: User,
  entries: { tmdbId: number; season: number; episode: number }[],
  watched: boolean
): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname) return;
  const auth = await resolvePlexServerAuth(user, cfg);
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
      const result = await setPlexWatched(cfg, auth.token, episode.plexRatingKey, watched);
      if (result) ok++;
      else fail++;
    }
    recordSearchLog(
      fail === 0 ? "info" : "warn",
      "plex.watchWrite",
      `${user.username} (plexId:${user.plexId ?? user.plexManagedUserId ?? "?"}, ${auth.source}) — « ${series.title} » : ${ok} épisode(s) ${watched ? "marqué(s) vu(s)" : "marqué(s) non vu(s)"} sur Plex, ${fail} échec(s)/pas encore synchronisable(s)`
    );
  }
}
