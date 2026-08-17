import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { eventBus } from "@/lib/events/EventBus";
import { addToTrash } from "@/lib/library/trashStore";
import { recordStatusTransition } from "@/lib/library/statusTransitions";
import type { LibraryMovie, LibrarySeries, LibraryStatus, LibrarySeason, LibraryEpisode } from "./types";

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
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[store] REFUSING to overwrite movie library — cannot read existing file:", err);
        return;
      }
    }
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
/** Reverse lookup for a Plex on-deck item's ratingKey (Continue Watching row)
 *  — a plain scan, not a cached map like the two lookups above: on-deck
 *  lists are always small (a handful of items), called once per dashboard
 *  refresh, so a per-item index isn't worth the extra cache-invalidation
 *  surface. */
export function getMovieByPlexRatingKey(ratingKey: string): LibraryMovie | null {
  return loadMovies().find((m) => m.plexRatingKey === ratingKey) ?? null;
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
  const oldMovie = list[i];
  const previousStatus = oldMovie.status;
  const updated = { ...oldMovie, ...patch };
  list[i] = updated;

  // Same targeted-patch reasoning as updateSeries() below — avoid forcing a
  // full O(library size) rebuild of every lookup map on every single call,
  // which a bulk run (autoGrab.ts calls this repeatedly across hundreds of
  // movies) turns into a sustained cost on the main thread.
  const byId = _moviesById, byTmdbId = _moviesByTmdbId, byActiveHash = _moviesByActiveHash;

  saveMovies(list);
  invalidateMovieCaches();

  if (byId && byTmdbId && byActiveHash) {
    byId.set(updated.id, updated);
    byTmdbId.set(updated.tmdbId, updated);
    if (oldMovie.activeInfoHash && oldMovie.activeInfoHash !== updated.activeInfoHash) byActiveHash.delete(oldMovie.activeInfoHash);
    if (updated.activeInfoHash) byActiveHash.set(updated.activeInfoHash, updated);
    _moviesById = byId;
    _moviesByTmdbId = byTmdbId;
    _moviesByActiveHash = byActiveHash;
    _lastMovies = list;
  }

  if ("status" in patch || "activeInfoHash" in patch) {
    eventBus.emit({ type: "movie_updated", movieId: id });
  }
  if (patch.status && patch.status !== previousStatus) {
    recordStatusTransition({ refType: "movie", refId: id, title: updated.title, from: previousStatus, to: patch.status });
  }
  return updated;
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
    if (!patch) continue;
    const previousStatus = list[i].status;
    list[i] = { ...list[i], ...patch };
    if (patch.status && patch.status !== previousStatus) {
      recordStatusTransition({ refType: "movie", refId: list[i].id, title: list[i].title, from: previousStatus, to: patch.status });
    }
  }
  saveMovies(list);
  invalidateMovieCaches();
  for (const id of patches.keys()) {
    eventBus.emit({ type: "movie_updated", movieId: id });
  }
}
/**
 * Silently drops movie records by id — no Trash entry, unlike removeMovie().
 * Only ever used to merge duplicate library entries (same tmdbId added
 * twice): the content isn't gone, it's still there under the entry that was
 * kept, so logging it as a user-visible "deletion" in Trash would be
 * misleading.
 */
export function pruneMovies(ids: Set<string>): number {
  if (ids.size === 0) return 0;
  const list = loadMovies();
  const filtered = list.filter((m) => !ids.has(m.id));
  if (filtered.length === list.length) return 0;
  saveMovies(filtered);
  return list.length - filtered.length;
}
export function removeMovie(id: string) {
  const list = loadMovies();
  const movie = list.find((m) => m.id === id);
  if (movie) {
    addToTrash({
      id: `movie_${movie.tmdbId}`,
      tmdbId: movie.tmdbId,
      type: "movie",
      title: movie.title,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      year: movie.year,
      rating: movie.rating,
      overview: movie.overview,
      deletedAt: Date.now(),
    });
  }
  saveMovies(list.filter((m) => m.id !== id));
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
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[store] REFUSING to overwrite series library — cannot read existing file:", err);
        return;
      }
    }
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
/** Reverse lookup for a Plex on-deck item's episode ratingKey (Continue
 *  Watching row) — same plain-scan rationale as getMovieByPlexRatingKey. */
export function findEpisodeByPlexRatingKey(
  ratingKey: string
): { series: LibrarySeries; season: LibrarySeason; episode: LibraryEpisode } | null {
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      const episode = season.episodes.find((e) => e.plexRatingKey === ratingKey);
      if (episode) return { series, season, episode };
    }
  }
  return null;
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
/** Diffs old vs new episode statuses within a series and journals each change — shared by updateSeries/updateSeriesList. */
function recordEpisodeStatusDiff(series: LibrarySeries, newSeasons: LibrarySeries["seasons"]) {
  const previous = new Map<string, LibraryStatus>();
  for (const season of series.seasons) {
    for (const ep of season.episodes) previous.set(`${season.seasonNumber}:${ep.episodeNumber}`, ep.status);
  }
  for (const season of newSeasons) {
    for (const ep of season.episodes) {
      const key = `${season.seasonNumber}:${ep.episodeNumber}`;
      const from = previous.get(key);
      if (from && from !== ep.status) {
        recordStatusTransition({
          refType: "episode",
          refId: `${series.id}:${season.seasonNumber}:${ep.episodeNumber}`,
          title: `${series.title} S${String(season.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")}`,
          from,
          to: ep.status,
        });
      }
    }
  }
}

export function updateSeries(id: string, patch: Partial<LibrarySeries>): LibrarySeries | null {
  const list = loadSeries();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const oldSeries = list[i];
  if (patch.seasons) recordEpisodeStatusDiff(oldSeries, patch.seasons);
  const updated = { ...oldSeries, ...patch };
  list[i] = updated;

  // Snapshot the live maps (if built) before saveSeries's blanket invalidation
  // below, so they can be patched for just THIS series instead of every
  // subsequent getSeries() call re-scanning every season/episode of every
  // series in the whole library from scratch (ensureSeriesMaps' activeHash
  // build). That full rescan — previously forced on every single call here —
  // was the actual reason a bulk run (autoGrabSeries.ts calls updateSeries
  // several times per item, across hundreds of items) stalled the whole
  // server: confirmed live via the event-loop-delay monitor, whose sustained
  // 30-120ms plateau appeared the instant a bulk search job started and
  // disappeared when it finished. Maps are still mutable objects even after
  // invalidateSeriesCaches() nulls the module-level pointers to them, so
  // capturing the references here and patching + reassigning them after is
  // safe and correct — it's the exact same objects, just kept alive.
  const byId = _seriesById, byTmdbId = _seriesByTmdbId, byActiveHash = _seriesByActiveHash;

  saveSeries(list);
  invalidateSeriesCaches();

  if (byId && byTmdbId && byActiveHash) {
    byId.set(updated.id, updated);
    byTmdbId.set(updated.tmdbId, updated);
    for (const season of oldSeries.seasons) {
      for (const ep of season.episodes) {
        if (ep.activeInfoHash) byActiveHash.delete(ep.activeInfoHash);
      }
    }
    for (const season of updated.seasons) {
      for (const ep of season.episodes) {
        if (ep.activeInfoHash) byActiveHash.set(ep.activeInfoHash, { series: updated, season: season.seasonNumber, episode: ep.episodeNumber });
      }
    }
    _seriesById = byId;
    _seriesByTmdbId = byTmdbId;
    _seriesByActiveHash = byActiveHash;
    _lastSeries = list;
  }

  if ("seasons" in patch || "status" in patch || "activeInfoHash" in patch) {
    eventBus.emit({ type: "series_updated", seriesId: id });
  }
  return updated;
}
export function updateSeriesList(patches: Map<string, Partial<LibrarySeries>>): void {
  if (patches.size === 0) return;
  const list = loadSeries();
  for (let i = 0; i < list.length; i++) {
    const patch = patches.get(list[i].id);
    if (!patch) continue;
    if (patch.seasons) recordEpisodeStatusDiff(list[i], patch.seasons);
    list[i] = { ...list[i], ...patch };
  }
  saveSeries(list);
  invalidateSeriesCaches();
  for (const id of patches.keys()) {
    eventBus.emit({ type: "series_updated", seriesId: id });
  }
}
/** Silently drops series records by id — see pruneMovies() for why this skips Trash. */
export function pruneSeries(ids: Set<string>): number {
  if (ids.size === 0) return 0;
  const list = loadSeries();
  const filtered = list.filter((s) => !ids.has(s.id));
  if (filtered.length === list.length) return 0;
  saveSeries(filtered);
  return list.length - filtered.length;
}
export function removeSeries(id: string) {
  const list = loadSeries();
  const series = list.find((s) => s.id === id);
  if (series) {
    addToTrash({
      id: `series_${series.tmdbId}`,
      tmdbId: series.tmdbId,
      type: "series",
      title: series.title,
      posterPath: series.posterPath,
      backdropPath: series.backdropPath,
      year: series.year,
      rating: series.rating,
      overview: series.overview,
      deletedAt: Date.now(),
    });
  }
  saveSeries(list.filter((s) => s.id !== id));
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
