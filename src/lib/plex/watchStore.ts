import fs from "node:fs";
import { jsonCacheReadFailed, readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { syncWatchedEpisodeState, syncWatchedMovieState } from "@/lib/userContext/watchBridge";
import { recordUserContextEvent } from "@/lib/userContext/ingest";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-watch-status.json");

export interface RecentWatch {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  at: number; // epoch ms
}

export interface WatchedEpisode {
  tmdbId: number; // series
  season: number;
  episode: number;
  /** Event timestamp (jamais la date d'import/sync — §36). Null = legacy. */
  at?: number | null;
}

export interface WatchStatus {
  userId: string;
  movies: number[]; // tmdbIds this user has watched
  episodes: WatchedEpisode[];
  /** Last positive event timestamp for each movie. Kept separately because
   * the backwards-compatible public movie shape is still a number[]. */
  movieWatchedAt?: Record<string, number>;
  recent?: RecentWatch[]; // last watched entries with timestamp ("quoi + quand")
  updatedAt: number;
}

export interface PlexWatchedMovie {
  tmdbId: number;
  title: string;
  watchedAt: number;
}

export interface PlexWatchedEpisode {
  tmdbId: number;
  season: number;
  episode: number;
  title: string;
  watchedAt: number;
}

/** Miroir progressStore depuis le point d'écriture UNIQUE (tous les writers
 *  passent par setWatched* : toggle, playback, import, IA). Import dynamique
 *  : progressStore importe déjà watchStore (cycle statique interdit). */
function mirrorProgress(
  userId: string,
  tmdbId: number,
  type: "movie" | "series",
  watched: boolean,
  season?: number,
  episode?: number,
  watchedAt?: number,
): void {
  import("@/lib/playback/progressStore")
    .then((m) => m.syncProgressWatched(userId, { tmdbId, type, season, episode }, watched, watchedAt))
    .catch(() => {});
}

const MAX_RECENT = 30;

function findOrCreate(list: WatchStatus[], userId: string): WatchStatus {
  let status = list.find((w) => w.userId === userId);
  if (!status) {
    status = { userId, movies: [], episodes: [], recent: [], updatedAt: Date.now() };
    list.push(status);
  }
  return status;
}

function upsertRecent(status: WatchStatus, entry: RecentWatch) {
  const recent = [...(status.recent ?? [])].filter((r) => !(r.tmdbId === entry.tmdbId && r.type === entry.type));
  recent.push(entry);
  recent.sort((a, b) => b.at - a.at);
  status.recent = recent.slice(0, MAX_RECENT);
}

function episodeKey(entry: { tmdbId: number; season: number; episode: number }) {
  return `${entry.tmdbId}.${entry.season}.${entry.episode}`;
}

/** Record one "watched" event (Plex history or direct Movviz playback),
 *  deduped by (tmdbId + type) keeping the most recent, newest first. */
export function recordWatched(userId: string, entry: RecentWatch) {
  const list = read();
  const status = findOrCreate(list, userId);
  upsertRecent(status, entry);
  status.updatedAt = Date.now();
  write(list);
}

/** Manual watched toggle — movies. Watched adds the tmdbId (and a dated
 *  "recent" entry), unwatched removes it. Read-modify-write so the Plex
 *  sync and manual marking coexist safely.
 *  `watchedAt` lets a caller that already knows the real historical watch
 *  date (e.g. a Netflix export) record it instead of defaulting to "now". */
export function setWatchedMovies(userId: string, tmdbIds: number[], watched: boolean, title = "", watchedAt?: number | null) {
  const list = read();
  const status = findOrCreate(list, userId);
  const at = watchedAt ?? Date.now();
  const applied: number[] = [];
  if (watched) {
    for (const tmdbId of tmdbIds) {
      const key = String(tmdbId);
      if (!status.movies.includes(tmdbId)) status.movies.push(tmdbId);
      status.movieWatchedAt ??= {};
      const effectiveAt = Math.max(status.movieWatchedAt[key] ?? 0, at);
      status.movieWatchedAt[key] = effectiveAt;
      upsertRecent(status, { tmdbId, type: "movie", title, at: effectiveAt });
      applied.push(tmdbId);
    }
  } else {
    for (const tmdbId of tmdbIds) {
      status.movies = status.movies.filter((movie) => movie !== tmdbId);
      applied.push(tmdbId);
    }
    // Unwatched changes current state only; past viewing history remains in
    // the append-only context ledger and must never be erased here.
  }
  status.updatedAt = Date.now();
  if (write(list)) {
    for (const tmdbId of applied) {
      mirrorProgress(userId, tmdbId, "movie", watched, undefined, undefined, at);
      syncWatchedMovieState({ userId, tmdbId, title, watched, at });
      // Immediate ledger row (not just the eventual lazy mirror in
      // bootstrap.ts's refreshLegacyUserContext, which can lag up to its
      // 5-minute refresh interval and only runs from AI-chat/Plex-sync
      // paths) — Netflix import, the manual toggle, and Plex sync all funnel
      // through this one function, so one emit point covers all three.
      recordUserContextEvent({
        userId,
        eventType: watched ? "watched_marked" : "watched_unmarked",
        source: "watch_store",
        sourceEventId: `watch:${userId}:movie:${tmdbId}:${watched ? "on" : "off"}:${at}`,
        tmdbId,
        mediaType: "movie",
        title: title || null,
        occurredAt: at,
      });
    }
  }
}

/** Manual watched toggle — episodes (tmdbId = series). Watched adds each
 *  episode (and one dated "recent" entry per series), unwatched removes.
 *  An entry can carry its own `watchedAt` (e.g. a Netflix export knows the
 *  real historical date per episode); entries without one default to now.
 *  When several entries for the same series carry different real dates,
 *  they are processed oldest-first so the series' single "recent" entry
 *  ends up holding the most recent real watch date, not import order. */
export function setWatchedEpisodes(
  userId: string,
  entries: { tmdbId: number; season: number; episode: number; watchedAt?: number | null }[],
  watched: boolean,
  title = ""
) {
  const list = read();
  const status = findOrCreate(list, userId);
  const key = episodeKey;
  const now = Date.now();
  const applied: typeof entries = [];
  if (watched) {
    const ordered = [...entries].sort((a, b) => (a.watchedAt ?? now) - (b.watchedAt ?? now));
    const existing = new Map(status.episodes.map((e) => [key(e), e]));
    for (const e of ordered) {
      const at = e.watchedAt ?? now;
      const prev = existing.get(key(e));
      if (!prev) {
        status.episodes.push({ tmdbId: e.tmdbId, season: e.season, episode: e.episode, at });
        existing.set(key(e), status.episodes[status.episodes.length - 1]);
      } else if (prev.at == null || at > prev.at) {
        // Conflit local : l'événement le plus récent gagne (§35-36).
        prev.at = at;
      }
      const effectiveAt = Math.max(prev?.at ?? 0, at);
      if (prev) prev.at = effectiveAt;
      upsertRecent(status, { tmdbId: e.tmdbId, type: "series", title, at: effectiveAt });
      applied.push(e);
    }
  } else {
    for (const entry of entries) {
      status.episodes = status.episodes.filter((episode) => key(episode) !== key(entry));
      applied.push(entry);
    }
  }
  status.updatedAt = now;
  if (write(list)) {
    for (const e of applied) {
      const at = e.watchedAt ?? now;
      mirrorProgress(userId, e.tmdbId, "series", watched, e.season, e.episode, at);
      syncWatchedEpisodeState({ userId, tmdbId: e.tmdbId, season: e.season, episode: e.episode, title, watched, at });
      recordUserContextEvent({
        userId,
        eventType: watched ? "watched_marked" : "watched_unmarked",
        source: "watch_store",
        sourceEventId: `watch:${userId}:episode:${e.tmdbId}:${e.season}:${e.episode}:${watched ? "on" : "off"}:${at}`,
        tmdbId: e.tmdbId,
        mediaType: "episode",
        seasonNumber: e.season,
        episodeNumber: e.episode,
        title: title || null,
        occurredAt: at,
      });
    }
  }
}

function read(): WatchStatus[] {
  return readJsonCached<WatchStatus[]>(FILE, []);
}
function write(list: WatchStatus[]): boolean {
  // Garde anti-écrasement (même classe de bug que la perte des 20 TB) : si
  // la dernière lecture du fichier a échoué (JSON corrompu, NAS
  // temporairement inaccessible), readJsonCached retourne le fallback [] —
  // le réécrire effacerait le watch status de TOUS les utilisateurs. On
  // refuse l'écriture et on loggue ; les données existantes restent intactes
  // et la prochaine écriture passera une fois la lecture redevenue saine.
  if (jsonCacheReadFailed(FILE)) {
    console.error("[watchStore] refus d'écrire " + FILE + " : lecture précédente en échec, données existantes conservées");
    return false;
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
  return true;
}

export function getWatchStatus(userId: string): WatchStatus | null {
  return read().find((w) => w.userId === userId) ?? null;
}

/**
 * Plex -> Movviz half of the single watched-state bridge.  Plex only exposes
 * an append-only history. A real Plex view is always stronger than an
 * absent/non-watched local state; public `movies` / `episodes` stay stable
 * for web, mobile and TV while positive event dates retain their order.
 */
export function mergePlexWatchedState(
  userId: string,
  movies: PlexWatchedMovie[],
  episodes: PlexWatchedEpisode[],
): WatchStatus {
  const list = read();
  const status = findOrCreate(list, userId);
  const movieSet = new Set(status.movies);
  const existingEpisodes = new Map(status.episodes.map((entry) => [episodeKey(entry), entry]));
  const addedMovies: PlexWatchedMovie[] = [];
  const addedEpisodes: PlexWatchedEpisode[] = [];

  for (const movie of movies) {
    const key = String(movie.tmdbId);
    if (!movieSet.has(movie.tmdbId)) {
      status.movies.push(movie.tmdbId);
      movieSet.add(movie.tmdbId);
      addedMovies.push(movie);
    }
    status.movieWatchedAt ??= {};
    const effectiveAt = Math.max(status.movieWatchedAt[key] ?? 0, movie.watchedAt);
    status.movieWatchedAt[key] = effectiveAt;
    upsertRecent(status, { tmdbId: movie.tmdbId, type: "movie", title: movie.title, at: effectiveAt });
  }

  for (const entry of episodes) {
    const key = episodeKey(entry);
    const existing = existingEpisodes.get(key);
    if (!existing) {
      const next: WatchedEpisode = { tmdbId: entry.tmdbId, season: entry.season, episode: entry.episode, at: entry.watchedAt };
      status.episodes.push(next);
      existingEpisodes.set(key, next);
      addedEpisodes.push(entry);
    } else if (existing.at == null || entry.watchedAt > existing.at) {
      existing.at = entry.watchedAt;
    }
    upsertRecent(status, { tmdbId: entry.tmdbId, type: "series", title: entry.title, at: Math.max(existing?.at ?? 0, entry.watchedAt) });
  }

  status.updatedAt = Date.now();
  write(list);
  // Plex imports are already entered in the append-only history ledger by
  // watchSync. This only aligns stale local resume records with the same
  // canonical watched state, without manufacturing duplicate history rows.
  for (const movie of addedMovies) mirrorProgress(userId, movie.tmdbId, "movie", true, undefined, undefined, movie.watchedAt);
  for (const entry of addedEpisodes) mirrorProgress(userId, entry.tmdbId, "series", true, entry.season, entry.episode, entry.watchedAt);
  return status;
}
