import { loadMovies, updateMovie, loadSeries, updateSeries } from "@/lib/library/store";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";

/**
 * Re-pull title/synopsis (and the rest of the cheap top-level fields that
 * come back on the same call) from TMDb for every library movie/series.
 * TMDb entries get edited/retranslated after release, and this is the only
 * thing that keeps Movviz's copy from drifting from the source of truth.
 * Sequential on purpose — a few thousand titles run once a day in the
 * background, no reason to hammer TMDb's rate limit for it.
 */
export async function refreshLibraryMetadata() {
  let moviesUpdated = 0;
  let seriesUpdated = 0;

  for (const movie of loadMovies()) {
    const meta = await fetchTmdbMovie(movie.tmdbId);
    if (!meta) continue;
    updateMovie(movie.id, {
      title: meta.title,
      overview: meta.overview,
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      rating: meta.rating,
      genres: meta.genres,
      releaseDate: meta.releaseDate,
      // Digital/physical dates are usually announced well after the initial
      // add (which often only has a theatrical date yet) — refreshing this
      // daily is how it ever gets filled in.
      vfReleaseDate: meta.vfReleaseDate,
    });
    moviesUpdated++;
  }

  for (const series of loadSeries()) {
    const meta = await fetchTmdbSeries(series.tmdbId);
    if (!meta) continue;
    updateSeries(series.id, {
      title: meta.title,
      overview: meta.overview,
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      rating: meta.rating,
      genres: meta.genres,
      tvStatus: meta.status,
    });
    seriesUpdated++;
  }

  return { moviesUpdated, seriesUpdated };
}
