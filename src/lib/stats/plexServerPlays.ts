import { loadPlexConfig } from "@/lib/plex/store";
import { getLocalAccounts, getServerHistorySince } from "@/lib/plex/client";
import { getAllBindings } from "@/lib/plex/plexBindingStore";
import { resolveCanonical } from "@/lib/plex/mediaIdentityMap";
import { loadMovies, loadSeries } from "@/lib/library/store";
import type { PlayRecord } from "@/lib/stats/playStats";

/**
 * Lectures Plex de TOUT le serveur (comme Tautulli) : tous les comptes, qu'ils
 * soient liés à un utilisateur Movviz ou non. Le journal local ne contient que
 * les vus des comptes liés, donc des comptes comme ceux de simples invités Plex
 * en étaient absents.
 */
export interface PlexServerPlays {
  plays: PlayRecord[];
  /** userId (id Movviz si lié, sinon `plex:<id>`) → nom affiché. */
  names: Map<string, string>;
}

const TTL_MS = 60_000;
const cache = new Map<number, { at: number; value: PlexServerPlays | null }>();

/** Identifiant stable et négatif pour un titre sans correspondance TMDB. */
export function syntheticId(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return -(Math.abs(h) + 1);
}

export async function loadPlexServerPlays(since: number): Promise<PlexServerPlays | null> {
  const bucket = Math.floor(since / 3_600_000);
  const hit = cache.get(bucket);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return null;
  const items = await getServerHistorySince(cfg, cfg.adminToken, since);
  if (!items) { cache.set(bucket, { at: Date.now(), value: null }); return null; }
  const accounts = await getLocalAccounts(cfg, cfg.adminToken);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const bindings = getAllBindings();
  const machine = cfg.machineIdentifier ?? "";

  const movies = new Map(loadMovies().filter((m) => m.plexRatingKey).map((m) => [String(m.plexRatingKey), m.tmdbId]));
  const seriesByKey = new Map(loadSeries().filter((s) => s.plexRatingKey).map((s) => [String(s.plexRatingKey), s.tmdbId]));
  const seriesByTitle = new Map(loadSeries().map((s) => [s.title.trim().toLowerCase(), s.tmdbId]));

  const names = new Map<string, string>();
  const plays: PlayRecord[] = [];
  for (const item of items) {
    const bound = bindings.find((b) => b.localAccountId === item.accountId && (!machine || b.machineIdentifier === machine))
      ?? bindings.find((b) => b.localAccountId === item.accountId && item.accountId > 1);
    const userId = bound ? bound.movvizUserId : `plex:${item.accountId}`;
    if (!bound) names.set(userId, accountName.get(item.accountId) || `Plex #${item.accountId}`);

    const identity = item.ratingKey && machine ? resolveCanonical(machine, item.ratingKey) : null;
    const label = item.type === "episode" ? item.grandparentTitle || item.title : item.title;
    let tmdbId = 0;
    if (item.type === "movie") {
      tmdbId = identity?.type === "movie" ? identity.tmdbId : (item.ratingKey ? movies.get(item.ratingKey) : undefined) ?? 0;
    } else {
      tmdbId = identity?.type === "episode" ? identity.tmdbShowId : seriesByTitle.get((item.grandparentTitle ?? "").trim().toLowerCase()) ?? (item.ratingKey ? seriesByKey.get(item.ratingKey) : undefined) ?? 0;
    }
    if (!tmdbId) tmdbId = syntheticId(`${item.type}:${label}`);

    plays.push({
      at: item.viewedAt,
      userId,
      source: "plex",
      tmdbId,
      mediaType: item.type,
      title: label?.trim() || "—",
      season: item.type === "episode" ? item.season : null,
      episode: item.type === "episode" ? item.episode : null,
      playedMs: null,
      durationMs: null,
      platform: null,
      browser: null,
      mode: null,
    });
  }
  const value = { plays, names };
  cache.set(bucket, { at: Date.now(), value });
  return value;
}
