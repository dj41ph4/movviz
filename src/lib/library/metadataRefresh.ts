import { loadMovies, updateMovies, loadSeries, updateSeriesList } from "@/lib/library/store";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { yieldToEventLoop } from "@/lib/jobs/cancelScope";

/** Écritures groupées : une réécriture du fichier bibliothèque par lot, pas par titre. */
const WRITE_BATCH = 50;

/** Ne garde que les champs qui ont réellement changé (null si aucun). */
function changedFields<T extends object>(current: T, next: Partial<T>): Partial<T> | null {
  const patch: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (JSON.stringify(current[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
      patch[key] = next[key];
      changed = true;
    }
  }
  return changed ? patch : null;
}

/**
 * Re-pull title/synopsis (and the rest of the cheap top-level fields that
 * come back on the same call) from TMDb for every library movie/series.
 * TMDb entries get edited/retranslated after release, and this is the only
 * thing that keeps Movviz's copy from drifting from the source of truth.
 * Sequential on purpose — a few thousand titles run once a day in the
 * background, no reason to hammer TMDb's rate limit for it.
 *
 * N'enregistre que les titres dont un champ a changé, par lots (avant :
 * chaque titre réécrivait toute la bibliothèque, même identique).
 */
export async function refreshLibraryMetadata() {
  let moviesUpdated = 0;
  let seriesUpdated = 0;

  let moviePatches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of loadMovies()) {
    await yieldToEventLoop();
    const meta = await fetchTmdbMovie(movie.tmdbId);
    if (!meta) continue;
    const patch = changedFields<LibraryMovie>(movie, {
      title: meta.title,
      overview: meta.overview,
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      rating: meta.rating,
      genres: meta.genres,
      isAnime: meta.isAnime,
      releaseDate: meta.releaseDate,
      // Digital/physical dates are usually announced well after the initial
      // add (which often only has a theatrical date yet) — refreshing this
      // daily is how it ever gets filled in.
      vfReleaseDate: meta.vfReleaseDate,
      // Backfill: entries added before originalTitle existed (or before
      // TMDb had it) keep it null forever otherwise.
      originalTitle: meta.originalTitle,
      imdbId: meta.imdbId,
    });
    if (!patch) continue;
    moviePatches.set(movie.id, patch);
    moviesUpdated++;
    if (moviePatches.size >= WRITE_BATCH) {
      updateMovies(moviePatches);
      moviePatches = new Map();
    }
  }
  updateMovies(moviePatches);

  let seriesPatches = new Map<string, Partial<LibrarySeries>>();
  for (const series of loadSeries()) {
    await yieldToEventLoop();
    const meta = await fetchTmdbSeries(series.tmdbId);
    if (!meta) continue;
    const patch = changedFields<LibrarySeries>(series, {
      title: meta.title,
      overview: meta.overview,
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      rating: meta.rating,
      genres: meta.genres,
      isAnime: meta.isAnime,
      tvStatus: meta.status,
      originalTitle: meta.originalTitle,
      imdbId: meta.imdbId,
      // tvdbId powers tvsearch on TR4KER (which only declares tvdb search).
      tvdbId: meta.tvdbId,
    });
    if (!patch) continue;
    seriesPatches.set(series.id, patch);
    seriesUpdated++;
    if (seriesPatches.size >= WRITE_BATCH) {
      updateSeriesList(seriesPatches);
      seriesPatches = new Map();
    }
  }
  updateSeriesList(seriesPatches);

  return { moviesUpdated, seriesUpdated };
}
