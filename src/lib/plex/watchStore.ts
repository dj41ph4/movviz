import fs from "node:fs";
import { jsonCacheReadFailed, readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { applyWatchDecision, getCurrentWatchState, type WatchSource } from "@/lib/userContext/watchBridge";
import { markPlexWatchedOutboxPending, shouldPropagateWatchedToPlex } from "./watchWrite";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
// Exporté pour scripts/repair-watch-user-contamination.ts (backup avant
// réparation, §93 du plan) — un seul endroit qui connaît ce chemin.
export const PLEX_WATCH_STATUS_FILE = path.join(CONFIG_DIR, "plex-watch-status.json");
const FILE = PLEX_WATCH_STATUS_FILE;

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
  const existing = status.recent?.find((r) => r.tmdbId === entry.tmdbId && r.type === entry.type);
  const recent = [...(status.recent ?? [])].filter((r) => !(r.tmdbId === entry.tmdbId && r.type === entry.type));
  // The most recent date always wins: an older episode marked watched (a
  // catch-up, an imported history) must never push a show the user is
  // watching right now back down the « recently watched » list.
  recent.push(existing && existing.at > entry.at ? { ...entry, at: existing.at } : entry);
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

/** Manual/canonical watched toggle — movies. Every real writer (toggle
 *  manuel, lecteur, IA, import Netflix — voir applyWatchDecision) passe par
 *  ici avec sa vraie origine (`source`). La décision SQL (résolveur LWW,
 *  userContext/watchBridge.ts) tranche EN PREMIER ; le JSON local
 *  (compatibilité `getWatchStatus`) n'est mis à jour que si la décision est
 *  acceptée — un événement plus ancien qu'une décision déjà en place (ex.
 *  une resynchro Plex tardive après un "marquer non vu" manuel) est rejeté
 *  et ne modifie plus jamais silencieusement l'état courant (§1-3 du plan
 *  de centralisation watched).
 *  `watchedAt` lets a caller that already knows the real historical watch
 *  date (e.g. a Netflix export) record it instead of defaulting to "now". */
export function setWatchedMovies(userId: string, tmdbIds: number[], watched: boolean, title = "", watchedAt?: number | null, source: WatchSource = "movviz_manual") {
  const list = read();
  const status = findOrCreate(list, userId);
  const at = watchedAt ?? Date.now();
  const accepted: number[] = [];
  for (const tmdbId of tmdbIds) {
    const result = applyWatchDecision({
      userId, tmdbId, mediaType: "movie", title: title || null,
      state: watched ? "watched" : "unwatched", occurredAt: at, source,
    });
    if (!result.accepted) continue;
    accepted.push(tmdbId);
    // Outbox durable (phase 6 du plan de finalisation) : PENDING créé ICI,
    // AVANT toute tentative réseau, pour la même décision acceptée que
    // celle qui vient de gagner en base — pas après un push fire-and-forget
    // qui pourrait ne jamais aboutir. plex_history/legacy_migration ne
    // propagent jamais vers Plex (§57 : éviter la boucle Plex -> Movviz ->
    // Plex).
    if (shouldPropagateWatchedToPlex(source)) markPlexWatchedOutboxPending(userId, "movie", tmdbId, undefined, undefined, result.revision, result.effectiveState as "watched" | "unwatched");
    if (watched) {
      const key = String(tmdbId);
      if (!status.movies.includes(tmdbId)) status.movies.push(tmdbId);
      status.movieWatchedAt ??= {};
      status.movieWatchedAt[key] = Math.max(status.movieWatchedAt[key] ?? 0, at);
      upsertRecent(status, { tmdbId, type: "movie", title, at });
    } else {
      status.movies = status.movies.filter((movie) => movie !== tmdbId);
      // Unwatched changes current state only; past viewing history remains in
      // the append-only context ledger and must never be erased here.
    }
  }
  if (accepted.length === 0) return false;
  status.updatedAt = Date.now();
  if (write(list)) {
    for (const tmdbId of accepted) mirrorProgress(userId, tmdbId, "movie", watched, undefined, undefined, at);
    return true;
  }
  return false;
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
  title = "",
  source: WatchSource = "movviz_manual"
) {
  const list = read();
  const status = findOrCreate(list, userId);
  const key = episodeKey;
  const now = Date.now();
  const accepted: (typeof entries[number] & { at: number })[] = [];
  if (watched) {
    const ordered = [...entries].sort((a, b) => (a.watchedAt ?? now) - (b.watchedAt ?? now));
    const existing = new Map(status.episodes.map((e) => [key(e), e]));
    for (const e of ordered) {
      const at = e.watchedAt ?? now;
      const result = applyWatchDecision({
        userId, tmdbId: e.tmdbId, mediaType: "episode", seasonNumber: e.season, episodeNumber: e.episode,
        title: title || null, state: "watched", occurredAt: at, source,
      });
      if (!result.accepted) continue;
      if (shouldPropagateWatchedToPlex(source)) markPlexWatchedOutboxPending(userId, "episode", e.tmdbId, e.season, e.episode, result.revision, result.effectiveState as "watched" | "unwatched");
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
      accepted.push({ ...e, at: effectiveAt });
    }
  } else {
    for (const entry of entries) {
      const at = entry.watchedAt ?? now;
      const result = applyWatchDecision({
        userId, tmdbId: entry.tmdbId, mediaType: "episode", seasonNumber: entry.season, episodeNumber: entry.episode,
        title: title || null, state: "unwatched", occurredAt: at, source,
      });
      if (!result.accepted) continue;
      if (shouldPropagateWatchedToPlex(source)) markPlexWatchedOutboxPending(userId, "episode", entry.tmdbId, entry.season, entry.episode, result.revision, result.effectiveState as "watched" | "unwatched");
      status.episodes = status.episodes.filter((episode) => key(episode) !== key(entry));
      accepted.push({ ...entry, at });
    }
  }
  if (accepted.length === 0) return false;
  status.updatedAt = now;
  if (write(list)) {
    for (const e of accepted) mirrorProgress(userId, e.tmdbId, "series", watched, e.season, e.episode, e.at);
    return true;
  }
  return false;
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
 * Réinitialise UNIQUEMENT la projection JSON (movies/episodes/recent) d'un
 * compte précis — phase 14-15 du plan de finalisation (réparation d'un
 * compte historiquement contaminé par la collision d'id corrigée cette
 * semaine). Ne touche JAMAIS `user_media_state`/`context_events` (SQLite) :
 * un userId partagé entre deux personnes rend les événements du ledger
 * indissociables (§95 du plan — signaler l'ambiguïté, jamais l'inventer),
 * donc seule la resynchro Plex qui suit peut reconstruire une projection
 * propre pour CE compte. Utilisée exclusivement par
 * scripts/repair-watch-user-contamination.ts, jamais en chemin normal.
 */
export function clearWatchStatusForUser(userId: string): { moviesCleared: number; episodesCleared: number } {
  const list = read();
  const status = list.find((w) => w.userId === userId);
  if (!status) return { moviesCleared: 0, episodesCleared: 0 };
  const moviesCleared = status.movies.length;
  const episodesCleared = status.episodes.length;
  status.movies = [];
  status.episodes = [];
  status.movieWatchedAt = {};
  status.recent = [];
  status.updatedAt = Date.now();
  write(list);
  return { moviesCleared, episodesCleared };
}

/**
 * Plex -> Movviz half of the single watched-state bridge. watchSync.ts
 * already resolves each real Plex history line through applyWatchDecision
 * before calling this (single ledger writer for Plex, §18 du plan), mais
 * cette fonction ne fait jamais une confiance aveugle à son appelant : pour
 * chaque titre reçu, elle revérifie l'état canonique courant
 * (getCurrentWatchState) et ne reflète dans le JSON local que ce qui n'est
 * pas explicitement contredit par une décision "non vu" déjà en place —
 * c'est ce qui empêche une resynchro Plex tardive (ou tout futur appelant
 * qui oublierait de filtrer en amont) de ressusciter un titre marqué non vu
 * plus récemment (§1 du plan). "unknown" (aucune décision SQL, ou moteur de
 * contexte désactivé — §74) n'est PAS traité comme un blocage : seul un
 * "unwatched" explicite l'est, pour ne jamais casser le repli JSON-only
 * quand MOVVIZ_CONTEXT_ENGINE_DISABLED est actif.
 */
export function mergePlexWatchedState(
  userId: string,
  movies: PlexWatchedMovie[],
  episodes: PlexWatchedEpisode[],
): WatchStatus {
  const list = read();
  const status = findOrCreate(list, userId);
  const existingEpisodes = new Map(status.episodes.map((entry) => [episodeKey(entry), entry]));
  const mirroredMovies: PlexWatchedMovie[] = [];
  const mirroredEpisodes: PlexWatchedEpisode[] = [];

  for (const movie of movies) {
    if (getCurrentWatchState({ userId, tmdbId: movie.tmdbId, mediaType: "movie" }) === "unwatched") continue;
    const key = String(movie.tmdbId);
    if (!status.movies.includes(movie.tmdbId)) status.movies.push(movie.tmdbId);
    status.movieWatchedAt ??= {};
    const effectiveAt = Math.max(status.movieWatchedAt[key] ?? 0, movie.watchedAt);
    status.movieWatchedAt[key] = effectiveAt;
    upsertRecent(status, { tmdbId: movie.tmdbId, type: "movie", title: movie.title, at: effectiveAt });
    mirroredMovies.push(movie);
  }

  for (const entry of episodes) {
    if (getCurrentWatchState({ userId, tmdbId: entry.tmdbId, mediaType: "episode", seasonNumber: entry.season, episodeNumber: entry.episode }) === "unwatched") continue;
    const key = episodeKey(entry);
    const existing = existingEpisodes.get(key);
    if (!existing) {
      const next: WatchedEpisode = { tmdbId: entry.tmdbId, season: entry.season, episode: entry.episode, at: entry.watchedAt };
      status.episodes.push(next);
      existingEpisodes.set(key, next);
    } else if (existing.at == null || entry.watchedAt > existing.at) {
      existing.at = entry.watchedAt;
    }
    upsertRecent(status, { tmdbId: entry.tmdbId, type: "series", title: entry.title, at: Math.max(existing?.at ?? 0, entry.watchedAt) });
    mirroredEpisodes.push(entry);
  }

  status.updatedAt = Date.now();
  write(list);
  for (const movie of mirroredMovies) mirrorProgress(userId, movie.tmdbId, "movie", true, undefined, undefined, movie.watchedAt);
  for (const entry of mirroredEpisodes) mirrorProgress(userId, entry.tmdbId, "series", true, entry.season, entry.episode, entry.watchedAt);
  return status;
}

/** Before Plex history dates were converted, shared users' views were stored
 *  in Unix SECONDS (a « vu le » in January 1970). A real view can never
 *  predate April 1970, so any value below 10^10 is seconds: multiplied once,
 *  idempotent afterwards. Returns how many dates were repaired. */
export function repairSecondTimestamps(): number {
  const toMs = (v: number | null | undefined) => (v != null && v > 0 && v < 10_000_000_000 ? v * 1000 : v);
  const list = read();
  let repaired = 0;
  for (const status of list) {
    for (const e of status.episodes) {
      const next = toMs(e.at);
      if (next !== e.at) { e.at = next as number; repaired++; }
    }
    for (const [id, at] of Object.entries(status.movieWatchedAt ?? {})) {
      const next = toMs(at);
      if (next !== at) { status.movieWatchedAt![id] = next as number; repaired++; }
    }
    let recentChanged = false;
    for (const r of status.recent ?? []) {
      const next = toMs(r.at);
      if (next !== r.at) { r.at = next as number; repaired++; recentChanged = true; }
    }
    if (recentChanged) status.recent!.sort((a, b) => b.at - a.at);
  }
  if (repaired > 0) write(list);
  return repaired;
}
