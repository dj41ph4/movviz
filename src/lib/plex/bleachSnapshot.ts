import { batchTmdbIds, getLibrarySections, getSectionRawItemsAtomic, getShowEpisodesAtomic, getPlexEpisodeOrdering } from "./client";
import type { PlexEpisodeItem, PlexServerConfig } from "./types";
import { BLEACH_TMDB_ID, projectBleachPlexEpisodes } from "@/lib/metadata/bleachEpisodeOrder";
import { getSeriesByTmdbId } from "@/lib/library/store";

/**
 * Plex can hold the original and TYBW as separate shows/sections under the
 * same TMDb ID. Reconcile their union once, never mark the other half missing
 * while processing just one show. Any incomplete/ambiguous snapshot aborts.
 */
export interface BleachPlexSnapshot { items: PlexEpisodeItem[]; complete: boolean; unresolved: number; uncertainShows: number }
export async function getBleachPlexSnapshot(cfg: PlexServerConfig, token: string): Promise<BleachPlexSnapshot | null> {
  const sections = await getLibrarySections(cfg, token);
  if (!sections.length) return null;
  const byEpisode = new Map<string, PlexEpisodeItem>();
  let unresolved = 0;
  let uncertainShows = 0;
  const library = getSeriesByTmdbId(BLEACH_TMDB_ID);
  const linkedEpisodeKeys = new Set(library?.seasons.flatMap((s) => s.episodes.map((e) => e.plexRatingKey).filter(Boolean)) ?? []);
  for (const section of sections.filter((s) => s.type === "show")) {
    const raw = await getSectionRawItemsAtomic(cfg, section.key, token);
    if (!raw.complete) return null;
    // A user may rename TYBW to an arbitrary title. Resolve every show's ID
    // before selecting Bleach, rather than claiming a name-filtered union is complete.
    const candidates = raw.items;
    const identities = await batchTmdbIds(cfg, token, candidates.map((show) => show.ratingKey));
    for (const show of candidates) {
      const identity = identities.get(show.ratingKey);
      // Missing/partial metadata is unknown, never proof that one half of
      // Bleach disappeared. Preserve the complete prior state on failure.
      if (!identity || identity.tmdbId == null) { uncertainShows++; continue; }
      if (identity.tmdbId !== BLEACH_TMDB_ID) continue;
      const episodes = await getShowEpisodesAtomic(cfg, show.ratingKey, token);
      if (!episodes.complete) return null;
      const ordering = await getPlexEpisodeOrdering(cfg, show.ratingKey, token, section.key);
      if (!ordering) return null;
      const mapped = projectBleachPlexEpisodes(ordering.title, episodes.items, ordering.order);
      unresolved += mapped.unresolved.length;
      for (const episode of mapped.items) {
        const key = `${episode.seasonNumber}:${episode.episodeNumber}`;
        if (!byEpisode.has(key) || linkedEpisodeKeys.has(episode.ratingKey)) byEpisode.set(key, episode);
      }
    }
  }
  return { items: [...byEpisode.values()], complete: unresolved === 0 && uncertainShows === 0, unresolved, uncertainShows };
}
