/**
 * « Ajouts récents » : un titre y entre à son PREMIER téléchargement — un film
 * à l'arrivée de son fichier, une série à l'arrivée de son premier épisode —
 * même s'il figurait déjà dans la bibliothèque comme manquant ou demandé.
 * Ensuite, un nouvel épisode ne fait plus remonter la série : il relève de la
 * rangée « Épisodes récemment ajoutés ». Ne dépend d'aucune donnée Plex.
 */

export const RECENTLY_ADDED_COUNT = 20;

export interface RecentlyAddedMovie {
  tmdbId: number;
  status: string;
  addedAt: number;
  latestAvailableAt?: number;
  file?: { addedAt?: number } | null;
}

export interface RecentlyAddedSeries {
  tmdbId: number;
  addedAt: number;
  firstAvailableAt?: number;
  hasAvailableEpisode: boolean;
}

export type RecentlyAddedEntry<M, S> =
  | { type: "movie"; item: M }
  | { type: "series"; item: S };

interface EpisodeLike {
  status: string;
  file?: { addedAt?: number } | null;
}

/** Arrivée du plus ancien épisode disponible (0 si aucun n'est daté). */
export function seriesFirstAvailableAt(seasons: readonly { episodes: readonly EpisodeLike[] }[]): number {
  let first = 0;
  for (const season of seasons) {
    for (const episode of season.episodes) {
      const at = episode.status === "available" ? episode.file?.addedAt ?? 0 : 0;
      if (at > 0 && (first === 0 || at < first)) first = at;
    }
  }
  return first;
}

export function movieRecentlyAddedAt(movie: RecentlyAddedMovie): number {
  return movie.latestAvailableAt || movie.file?.addedAt || movie.addedAt || 0;
}

/** Premier épisode arrivé — jamais le dernier ; à défaut, la date d'ajout. */
export function seriesRecentlyAddedAt(show: Pick<RecentlyAddedSeries, "addedAt" | "firstAvailableAt">): number {
  return show.firstAvailableAt || show.addedAt || 0;
}

/** Films disponibles et séries ayant au moins un épisode disponible, plus récents d'abord. */
export function selectRecentlyAdded<M extends RecentlyAddedMovie, S extends RecentlyAddedSeries>(
  movies: readonly M[],
  series: readonly S[],
  limit = RECENTLY_ADDED_COUNT,
): RecentlyAddedEntry<M, S>[] {
  const entries: { at: number; entry: RecentlyAddedEntry<M, S> }[] = [
    ...movies.filter((movie) => movie.status === "available")
      .map((item) => ({ at: movieRecentlyAddedAt(item), entry: { type: "movie" as const, item } })),
    ...series.filter((show) => show.hasAvailableEpisode)
      .map((item) => ({ at: seriesRecentlyAddedAt(item), entry: { type: "series" as const, item } })),
  ];
  return entries.sort((a, b) => b.at - a.at).slice(0, limit).map(({ entry }) => entry);
}
