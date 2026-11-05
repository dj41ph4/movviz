import { loadMovies, updateMovies, loadSeries, updateSeriesList } from "@/lib/library/store";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { yieldToEventLoop, trackJobProgress } from "@/lib/jobs/cancelScope";
import { isFresh, markManyDone } from "@/lib/library/taskMemory";

/** Écritures groupées : une réécriture du fichier bibliothèque par lot, pas par titre. */
const WRITE_BATCH = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMORY_SCOPE = "metadata-refresh";

/**
 * Fréquence de revérification d'une fiche selon son âge : une fiche récente ou à venir bouge
 * tous les jours (synopsis, date de sortie, affiche), un film vieux de dix ans presque jamais.
 * Un titre tout juste ajouté est lui aussi revu chaque jour pendant deux semaines.
 */
export function movieIntervalMs(movie: LibraryMovie, now: number): number {
  if (now - movie.addedAt < 14 * DAY_MS) return DAY_MS;
  const dates = [movie.vfReleaseDate, movie.releaseDate].map((d) => (d ? Date.parse(d) : Number.NaN)).filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return DAY_MS;
  const age = now - Math.max(...dates);
  if (age < 90 * DAY_MS) return DAY_MS;
  if (age < 2 * 365 * DAY_MS) return 7 * DAY_MS;
  return 30 * DAY_MS;
}

export function seriesIntervalMs(series: LibrarySeries, now: number): number {
  if (now - series.addedAt < 14 * DAY_MS) return DAY_MS;
  const ended = /^(ended|canceled|cancelled)$/i.test(series.tvStatus ?? "");
  return ended ? 30 * DAY_MS : DAY_MS;
}

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
 *
 * Incrémental : chaque titre est revérifié selon son âge (voir movieIntervalMs), la date du
 * dernier passage étant mémorisée d'un redémarrage à l'autre et étalée pour que les
 * échéances ne retombent pas toutes le même jour. Un titre jamais vérifié l'est tout de suite.
 * `force` repasse sur tout.
 */
export async function refreshLibraryMetadata(opts?: { force?: boolean }) {
  let moviesUpdated = 0;
  let seriesUpdated = 0;
  const now = Date.now();
  const force = opts?.force === true;
  const allMovies = loadMovies().filter((m) => force || !isFresh(MEMORY_SCOPE, `movie:${m.id}`, movieIntervalMs(m, now), undefined, now));
  const allSeries = loadSeries().filter((s) => force || !isFresh(MEMORY_SCOPE, `series:${s.id}`, seriesIntervalMs(s, now), undefined, now));
  const tick = trackJobProgress(allMovies.length + allSeries.length);
  const movieDone: string[] = [];
  const seriesDone: string[] = [];

  let moviePatches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of allMovies) {
    await yieldToEventLoop();
    tick();
    const meta = await fetchTmdbMovie(movie.tmdbId);
    if (!meta) continue;
    movieDone.push(movie.id);
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
  for (const series of allSeries) {
    await yieldToEventLoop();
    tick();
    const meta = await fetchTmdbSeries(series.tmdbId);
    if (!meta) continue;
    seriesDone.push(series.id);
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

  // Échéance suivante étalée de 25 % pour ne pas retomber toutes le même jour.
  const byId = new Map(allMovies.map((m) => [m.id, movieIntervalMs(m, now)] as const));
  for (const [interval, ids] of [[DAY_MS, movieDone.filter((id) => byId.get(id) === DAY_MS)], [7 * DAY_MS, movieDone.filter((id) => byId.get(id) === 7 * DAY_MS)], [30 * DAY_MS, movieDone.filter((id) => byId.get(id) === 30 * DAY_MS)]] as const) {
    markManyDone(MEMORY_SCOPE, ids.map((id) => `movie:${id}`), undefined, Math.floor(interval / 4), now);
  }
  const seriesById = new Map(allSeries.map((s) => [s.id, seriesIntervalMs(s, now)] as const));
  for (const interval of [DAY_MS, 30 * DAY_MS]) {
    markManyDone(MEMORY_SCOPE, seriesDone.filter((id) => seriesById.get(id) === interval).map((id) => `series:${id}`), undefined, Math.floor(interval / 4), now);
  }

  return { moviesUpdated, seriesUpdated };
}
