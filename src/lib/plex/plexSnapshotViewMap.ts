import type { PlexViewState, RawLibraryItem } from "./client";

/**
 * États de vue lus DIRECTEMENT dans les listings de bibliothèque. Un listing de section
 * (`/library/sections/X/all`, avec `type=4` pour les épisodes) porte déjà viewCount,
 * lastViewedAt et viewOffset : le snapshot n'a plus besoin de relire chaque média par
 * paquets de 50 (≈ 760 requêtes séquentielles pour 38 000 médias) ni de lister les
 * épisodes série par série (708 requêtes). Plex n'écrit viewCount qu'une fois le média vu :
 * absent = 0, comme le faisait déjà batchPlexViewState.
 */
export function rawToViewState(item: RawLibraryItem): PlexViewState {
  return {
    ratingKey: item.ratingKey,
    viewCount: item.viewCount ?? 0,
    // Plex renvoie des secondes ; l'application travaille en millisecondes.
    lastViewedAt: item.lastViewedAt == null ? undefined : (item.lastViewedAt < 10_000_000_000 ? item.lastViewedAt * 1000 : item.lastViewedAt),
    viewOffset: item.viewOffset,
    duration: item.duration,
    type: item.type,
  };
}

/** Un épisode sans numéro de saison/épisode n'est pas rattachable à une fiche : même filtre qu'avant (allLeaves). */
export function numberedEpisodes(items: RawLibraryItem[]): RawLibraryItem[] {
  return (items as Array<RawLibraryItem & { parentIndex?: number; index?: number }>).filter((e) => e.parentIndex != null && e.index != null);
}

export function viewMapFromListings(movies: RawLibraryItem[], episodes: RawLibraryItem[]): Map<string, PlexViewState> {
  const map = new Map<string, PlexViewState>();
  for (const item of movies) map.set(item.ratingKey, rawToViewState(item));
  for (const item of episodes) map.set(item.ratingKey, rawToViewState(item));
  return map;
}

/**
 * Garde-fou de la voie rapide : le listing d'épisodes doit couvrir (à 2 % près) le total
 * d'épisodes annoncé par les séries elles-mêmes (leafCount). Un listing tronqué ferait passer
 * des épisodes pour disparus ; sans total annoncé on ne peut rien vérifier — dans les deux
 * cas le snapshot retombe sur le parcours série par série, plus lent mais éprouvé.
 */
export function episodesListingConsistent(listedEpisodes: number, announcedEpisodes: number): boolean {
  if (!(announcedEpisodes > 0)) return false;
  return listedEpisodes >= Math.floor(announcedEpisodes * 0.98);
}
