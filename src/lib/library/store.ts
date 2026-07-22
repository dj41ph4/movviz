import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { eventBus } from "@/lib/events/EventBus";
import type { LibraryMovie, LibrarySeries } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const MOVIES_FILE = path.join(CONFIG_DIR, "library-movies.json");
const SERIES_FILE = path.join(CONFIG_DIR, "library-series.json");

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}

/** Paths of the on-disk library files — for callers that memoize a derived computation by mtime. */
export function libraryFilePaths(): string[] {
  return [MOVIES_FILE, SERIES_FILE];
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

// ---- Movies ----

export function loadMovies(): LibraryMovie[] {
  return readJson<LibraryMovie[]>(MOVIES_FILE, []);
}
function saveMovies(list: LibraryMovie[]) {
  writeJson(MOVIES_FILE, list);
}
export function getMovie(id: string): LibraryMovie | null {
  return loadMovies().find((m) => m.id === id) ?? null;
}
export function getMovieByTmdbId(tmdbId: number): LibraryMovie | null {
  return loadMovies().find((m) => m.tmdbId === tmdbId) ?? null;
}
export function addMovie(movie: LibraryMovie): LibraryMovie {
  const list = loadMovies();
  const existing = list.find((m) => m.tmdbId === movie.tmdbId);
  if (existing) return existing;
  list.push(movie);
  saveMovies(list);
  return movie;
}
export function updateMovie(id: string, patch: Partial<LibraryMovie>): LibraryMovie | null {
  const list = loadMovies();
  const i = list.findIndex((m) => m.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveMovies(list);
  if ("status" in patch || "activeInfoHash" in patch) {
    eventBus.emit({ type: "movie_updated", movieId: id });
  }
  return list[i];
}

/**
 * Apply many patches with a single disk write instead of one full-array
 * rewrite per movie. A caller looping over hundreds of movies (e.g. a
 * background scan) that called updateMovie() per item was re-serializing
 * the entire library file on every iteration — with concurrent callers
 * resolving faster than disk I/O could keep up, that piled up pending
 * writes (each holding its own full JSON copy) and ran the process out of
 * memory. Batch instead.
 */
export function updateMovies(patches: Map<string, Partial<LibraryMovie>>): void {
  if (patches.size === 0) return;
  const list = loadMovies();
  for (let i = 0; i < list.length; i++) {
    const patch = patches.get(list[i].id);
    if (patch) list[i] = { ...list[i], ...patch };
  }
  saveMovies(list);
  for (const id of patches.keys()) {
    eventBus.emit({ type: "movie_updated", movieId: id });
  }
}
export function removeMovie(id: string) {
  saveMovies(loadMovies().filter((m) => m.id !== id));
}
/** Danger zone: wipe every movie from Movviz's own database. Never touches Plex or files on disk. */
export function clearMovies() {
  saveMovies([]);
}
/** Find the movie awaiting import for a given in-flight torrent. */
export function getMovieByActiveHash(infoHash: string): LibraryMovie | null {
  return loadMovies().find((m) => m.activeInfoHash === infoHash) ?? null;
}

// ---- Series ----

export function loadSeries(): LibrarySeries[] {
  return readJson<LibrarySeries[]>(SERIES_FILE, []);
}
function saveSeries(list: LibrarySeries[]) {
  writeJson(SERIES_FILE, list);
}
export function getSeries(id: string): LibrarySeries | null {
  return loadSeries().find((s) => s.id === id) ?? null;
}
export function getSeriesByTmdbId(tmdbId: number): LibrarySeries | null {
  return loadSeries().find((s) => s.tmdbId === tmdbId) ?? null;
}
export function addSeries(series: LibrarySeries): LibrarySeries {
  const list = loadSeries();
  const existing = list.find((s) => s.tmdbId === series.tmdbId);
  if (existing) return existing;
  list.push(series);
  saveSeries(list);
  return series;
}
export function updateSeries(id: string, patch: Partial<LibrarySeries>): LibrarySeries | null {
  const list = loadSeries();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveSeries(list);
  if ("seasons" in patch || "status" in patch || "activeInfoHash" in patch) {
    eventBus.emit({ type: "series_updated", seriesId: id });
  }
  return list[i];
}
export function updateSeriesList(patches: Map<string, Partial<LibrarySeries>>): void {
  if (patches.size === 0) return;
  const list = loadSeries();
  for (let i = 0; i < list.length; i++) {
    const patch = patches.get(list[i].id);
    if (patch) list[i] = { ...list[i], ...patch };
  }
  saveSeries(list);
  for (const id of patches.keys()) {
    eventBus.emit({ type: "series_updated", seriesId: id });
  }
}
export function removeSeries(id: string) {
  saveSeries(loadSeries().filter((s) => s.id !== id));
}
/** Danger zone: wipe every series from Movviz's own database. Never touches Plex or files on disk. */
export function clearSeries() {
  saveSeries([]);
}
export function getSeriesByActiveHash(
  infoHash: string
): { series: LibrarySeries; season: number; episode: number } | null {
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.activeInfoHash === infoHash) {
          return { series, season: season.seasonNumber, episode: ep.episodeNumber };
        }
      }
    }
  }
  return null;
}
