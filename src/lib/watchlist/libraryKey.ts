import type { WatchlistItem } from "./types";

/**
 * Clé « type:tmdbId » d'un titre de la liste dans la bibliothèque. Un épisode de la liste se
 * rattache à sa série : on ne propose pas « Ajouter à la bibliothèque » pour une série déjà présente.
 */
export function watchlistLibraryKey(item: Pick<WatchlistItem, "type" | "tmdbId">): string {
  return `${item.type === "movie" ? "movie" : "series"}:${item.tmdbId}`;
}
