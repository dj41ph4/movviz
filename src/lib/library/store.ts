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

// ---- Lazy reverse-index caches ----
// Rebuilt when the source array reference changes (readJsonCached returns
// the same ref until a write or stat mismatch).  Avoids O(n) scans inside
// hot paths that call getMovieByTmdbId / getSeriesByActiveHash in a loop.

let _lastMovies: LibraryMovie[] | null = null;
let _moviesByTmdbId: Map<number, LibraryMovie> | null = null;
let _moviesById: Map<string, LibraryMovie> | null = null;
let _moviesByActiveHash: Map<string, LibraryMovie> | null = null;

function ensureMovieMaps() {
  const movies = loadMovies();
  if (_lastMovies === movies) return;
  _lastMovies = movies;
  _moviesByTmdbId = new Map(movies.map((m) => [m.tmdbId, m]));
  _moviesById = new Map(movies.map((m) => [m.id, m]));
  _moviesByActiveHash = new Map(
    movies.filter((m) => m.activeInfoHash).map((m) => [m.activeInfoHash!, m])
  );
}

let _lastSeries: LibrarySeries[] | null = null;
let _seriesByTmdbId: Map<number, LibrarySeries> | null = null;
let _seriesById: Map<string, LibrarySeries> | null = null;
let _seriesByActiveHash: Map<string, { series: LibrarySeries; season: number; episode: number }> | null = null;

function ensureSeriesMaps() {
  const seriesList = loadSeries();
  if (_lastSeries === seriesList) return;
  _lastSeries = seriesList;
  _seriesByTmdbId = new Map(seriesList.map((s) => [s.tmdbId, s]));
  _seriesById = new Map(seriesList.map((s) => [s.id, s]));
  const activeHash = new Map<string, { series: LibrarySeries; season: number; episode: number }>();
  for (const s of seriesList) {
    for (const season of s.seasons) {
      for (const ep of season.episodes) {
        if (ep.activeInfoHash) {
          activeHash.set(ep.activeInfoHash, { series: s, season: season.seasonNumber, episode: ep.episodeNumber });
        }
      }
    }
  }
  _seriesByActiveHash = activeHash;
}

function invalidateMovieCaches() {
  _lastMovies = null;
  _moviesByTmdbId = null;
  _moviesById = null;
  _moviesByActiveHash = null;
}

function invalidateSeriesCaches() {
  _lastSeries = null;
  _seriesByTmdbId = null;
  _seriesById = null;
  _seriesByActiveHash = null;
}

// ---- Movies ----

export function loadMovies(): LibraryMovie[] {
  const list = readJson<LibraryMovie[]>(MOVIES_FILE, []);
  // Safety: if the fallback [] was returned due to read failure (NAS down, corruption)
  // rather than the file being genuinely empty, log it. Empty list on genuine empty
  // file is fine, but a ~20MB file that suddenly returns [] is a data integrity alarm.
  if (list.length === 0) {
    try {
      const raw = fs.readFileSync(MOVIES_FILE, "utf8");
      if (raw.trim().length > 2) {
        console.error("[store] MOVIES_FILE read returned [] but file is non-empty — possible corruption or permission issue");
      }
    } catch { /* file genuinely missing or inaccessible — expected */ }
  }
  return list;
}
function saveMovies(list: LibraryMovie[], isExplicitClear = false) {
  if (list.length === 0 && !isExplicitClear) {
    try {
      const old = JSON.parse(fs.readFileSync(MOVIES_FILE, "utf8"));
      if (Array.isArray(old) && old.length > 10) {
        console.error("[store] REFUSING to overwrite movie library: " + old.length + " entries → 0 — NAS may be down");
        return;
      }
    } catch { /* file missing — fine to write */ }
  }
  writeJson(MOVIES_FILE, list);
  invalidateMovieCaches();
}
export function getMovie(id: string): LibraryMovie | null {
  ensureMovieMaps();
  return _moviesById!.get(id) ?? null;
}
export function getMovieByTmdbId(tmdbId: number): LibraryMovie | null {
  ensureMovieMaps();
  return _moviesByTmdbId!.get(tmdbId) ?? null;
}
export function addMovie(movie: LibraryMovie): LibraryMovie {
  ensureMovieMaps();
  const existing = _moviesByTmdbId!.get(movie.tmdbId);
  if (existing) return existing;
  const list = loadMovies();
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
  invalidateMovieCaches();
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
  invalidateMovieCaches();
  for (const id of patches.keys()) {
    eventBus.emit({ type: "movie_updated", movieId: id });
  }
}
export function removeMovie(id: string) {
  saveMovies(loadMovies().filter((m) => m.id !== id));
}
/** Danger zone: wipe every movie from Movviz's own database. Never touches Plex or files on disk. */
export function clearMovies() {
  saveMovies([] as LibraryMovie[], true);
}
/** Find the movie awaiting import for a given in-flight torrent. */
export function getMovieByActiveHash(infoHash: string): LibraryMovie | null {
  ensureMovieMaps();
  return _moviesByActiveHash!.get(infoHash) ?? null;
}

// ---- Series ----

export function loadSeries(): LibrarySeries[] {
  const list = readJson<LibrarySeries[]>(SERIES_FILE, []);
  if (list.length === 0) {
    try {
      const raw = fs.readFileSync(SERIES_FILE, "utf8");
      if (raw.trim().length > 2) {
        console.error("[store] SERIES_FILE read returned [] but file is non-empty — possible corruption or permission issue");
      }
    } catch { /* file genuinely missing or inaccessible */ }
  }
  return list;
}
function saveSeries(list: LibrarySeries[], isExplicitClear = false) {
  if (list.length === 0 && !isExplicitClear) {
    try {
      const old = JSON.parse(fs.readFileSync(SERIES_FILE, "utf8"));
      if (Array.isArray(old) && old.length > 10) {
        console.error("[store] REFUSING to overwrite series library: " + old.length + " entries → 0 — NAS may be down");
        return;
      }
    } catch { /* file missing — fine to write */ }
  }
  writeJson(SERIES_FILE, list);
  invalidateSeriesCaches();
}
export function getSeries(id: string): LibrarySeries | null {
  ensureSeriesMaps();
  return _seriesById!.get(id) ?? null;
}
export function getSeriesByTmdbId(tmdbId: number): LibrarySeries | null {
  ensureSeriesMaps();
  return _seriesByTmdbId!.get(tmdbId) ?? null;
}
export function addSeries(series: LibrarySeries): LibrarySeries {
  ensureSeriesMaps();
  const existing = _seriesByTmdbId!.get(series.tmdbId);
  if (existing) return existing;
  const list = loadSeries();
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
  invalidateSeriesCaches();
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
  invalidateSeriesCaches();
  for (const id of patches.keys()) {
    eventBus.emit({ type: "series_updated", seriesId: id });
  }
}
export function removeSeries(id: string) {
  saveSeries(loadSeries().filter((s) => s.id !== id));
}
/** Danger zone: wipe every series from Movviz's own database. Never touches Plex or files on disk. */
export function clearSeries() {
  saveSeries([] as LibrarySeries[], true);
}
export function getSeriesByActiveHash(
  infoHash: string
): { series: LibrarySeries; season: number; episode: number } | null {
  ensureSeriesMaps();
  return _seriesByActiveHash!.get(infoHash) ?? null;
}
