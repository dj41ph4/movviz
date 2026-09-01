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

export interface WatchStatus {
  userId: string;
  movies: number[]; // tmdbIds this user has watched
  episodes: { tmdbId: number; season: number; episode: number }[]; // tmdbId = series
  recent?: RecentWatch[]; // last watched entries with timestamp ("quoi + quand")
  updatedAt: number;
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
  if (watched) {
    for (const tmdbId of tmdbIds) {
      if (!status.movies.includes(tmdbId)) status.movies.push(tmdbId);
      upsertRecent(status, { tmdbId, type: "movie", title, at });
    }
  } else {
    const remove = new Set(tmdbIds);
    status.movies = status.movies.filter((m) => !remove.has(m));
    status.recent = (status.recent ?? []).filter((r) => !(r.type === "movie" && remove.has(r.tmdbId)));
  }
  status.updatedAt = Date.now();
  if (write(list)) {
    for (const tmdbId of tmdbIds) {
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
  const key = (e: { tmdbId: number; season: number; episode: number }) => `${e.tmdbId}.${e.season}.${e.episode}`;
  const now = Date.now();
  if (watched) {
    const ordered = [...entries].sort((a, b) => (a.watchedAt ?? now) - (b.watchedAt ?? now));
    const existing = new Set(status.episodes.map(key));
    for (const e of ordered) {
      if (!existing.has(key(e))) {
        status.episodes.push({ tmdbId: e.tmdbId, season: e.season, episode: e.episode });
        existing.add(key(e));
      }
      upsertRecent(status, { tmdbId: e.tmdbId, type: "series", title, at: e.watchedAt ?? now });
    }
  } else {
    const remove = new Set(entries.map(key));
    status.episodes = status.episodes.filter((e) => !remove.has(key(e)));
    for (const tmdbId of new Set(entries.map((e) => e.tmdbId))) {
      if (!status.episodes.some((e) => e.tmdbId === tmdbId)) {
        status.recent = (status.recent ?? []).filter((r) => !(r.tmdbId === tmdbId && r.type === "series"));
      }
    }
  }
  status.updatedAt = now;
  if (write(list)) {
    for (const e of entries) {
      const at = e.watchedAt ?? now;
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

export function saveWatchStatus(status: WatchStatus) {
  const list = read();
  const i = list.findIndex((w) => w.userId === status.userId);
  if (i >= 0) list[i] = status;
  else list.push(status);
  write(list);
}
