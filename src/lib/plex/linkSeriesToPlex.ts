import { loadPlexConfig } from "./store";
import { getShowEpisodes } from "./client";
import { getSeries, updateSeries } from "@/lib/library/store";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";

export type LinkResult =
  | { ok: true; linked: number; alreadyLinked: number; notInPlex: number }
  | { ok: false; error: "series_not_found" | "plex_not_connected" | "plex_unreachable" | "unsupported_series" };

/**
 * Relie les épisodes d'une série DÉJÀ présente dans Movviz à leurs fiches Plex : seule la clé Plex
 * manquante est posée (par saison + numéro d'épisode), sans toucher au statut, au fichier ni à la
 * lecture. C'est ce lien qui permet à la synchro des vues de retrouver l'épisode. Un épisode Plex déjà
 * relié à un autre épisode de la série n'est jamais réutilisé (pas de doublon de lien).
 */
export async function linkSeriesEpisodesToPlex(seriesId: string, showKey: string): Promise<LinkResult> {
  const series = getSeries(seriesId);
  if (!series) return { ok: false, error: "series_not_found" };
  // Bleach a sa propre numérotation (deux entrées, deux ordres) : jamais relié par cette voie.
  if (series.tmdbId === BLEACH_TMDB_ID) return { ok: false, error: "unsupported_series" };
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return { ok: false, error: "plex_not_connected" };
  const plexEpisodes = await getShowEpisodes(cfg, showKey, cfg.adminToken);
  if (plexEpisodes.length === 0) return { ok: false, error: "plex_unreachable" };

  const used = new Set<string>();
  for (const season of series.seasons) for (const ep of season.episodes) if (ep.plexRatingKey) used.add(ep.plexRatingKey);
  const byCoordinates = new Map<string, string>();
  for (const pe of plexEpisodes) {
    if (pe.ratingKey) byCoordinates.set(`${pe.seasonNumber}:${pe.episodeNumber}`, pe.ratingKey);
  }

  let linked = 0, alreadyLinked = 0, notInPlex = 0;
  const seasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((ep) => {
      if (ep.plexRatingKey) { alreadyLinked++; return ep; }
      const rk = byCoordinates.get(`${ep.seasonNumber}:${ep.episodeNumber}`);
      if (!rk || used.has(rk)) { notInPlex++; return ep; }
      used.add(rk);
      linked++;
      return { ...ep, plexRatingKey: rk };
    }),
  }));

  if (linked > 0 || !series.plexRatingKey) {
    updateSeries(seriesId, { ...(linked > 0 ? { seasons } : {}), plexRatingKey: series.plexRatingKey ?? showKey });
  }
  return { ok: true, linked, alreadyLinked, notInPlex };
}
