import { loadMovies, loadSeries } from "@/lib/library/store";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getWatchedTitles } from "@/lib/recommender/watchedTitles";
import type { MetaSearchResult } from "@/lib/metadata/types";

const REWATCH_LIMIT = 20;

/**
 * Rangée « À revoir sans modération » : films et séries déjà vus (titres
 * marqués vus + historique de lecture, même définition que les suggestions —
 * watchedTitles.ts) et encore lisibles dans la bibliothèque, du plus
 * récemment vu au plus ancien. Un titre écarté d'un 👎 n'y revient pas.
 * Construit uniquement depuis les données locales : aucun appel TMDb.
 */
export function buildRewatchRow(userId: string): MetaSearchResult[] {
  const disliked = new Set(getFeedback(userId).filter((f) => !f.liked).map((f) => `${f.type}:${f.tmdbId}`));
  const rows: Array<{ at: number; item: MetaSearchResult }> = [];

  const watchedMovies = getWatchedTitles(userId, "movie");
  if (watchedMovies.size) {
    for (const movie of loadMovies()) {
      const at = watchedMovies.get(movie.tmdbId);
      if (at === undefined || movie.status !== "available" || disliked.has(`movie:${movie.tmdbId}`)) continue;
      rows.push({
        at,
        item: {
          tmdbId: movie.tmdbId, type: "movie", title: movie.title, year: movie.year ?? null, releaseDate: null,
          overview: movie.overview ?? "", posterPath: movie.posterPath ?? null,
          backdropPath: movie.customBackdropPath ?? movie.backdropPath ?? null, rating: movie.rating ?? 0,
        },
      });
    }
  }

  const watchedSeries = getWatchedTitles(userId, "series");
  if (watchedSeries.size) {
    for (const series of loadSeries()) {
      const at = watchedSeries.get(series.tmdbId);
      if (at === undefined || disliked.has(`series:${series.tmdbId}`)) continue;
      const playable = series.seasons.some((season) => season.episodes.some((ep) => ep.status === "available"));
      if (!playable) continue;
      rows.push({
        at,
        item: {
          tmdbId: series.tmdbId, type: "series", title: series.title, year: series.year ?? null, releaseDate: null,
          overview: series.overview ?? "", posterPath: series.posterPath ?? null,
          backdropPath: series.customBackdropPath ?? series.backdropPath ?? null, rating: series.rating ?? 0,
        },
      });
    }
  }

  return rows.sort((a, b) => b.at - a.at).slice(0, REWATCH_LIMIT).map((r) => r.item);
}
