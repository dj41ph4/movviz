import { getWatchStatus, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { getSeriesByTmdbId } from "@/lib/library/store";

/**
 * Agrégation canonique UNIQUE film/épisode → saison → série (plan HISTORIQUE).
 *
 * Source de vérité : watchStore (movies[]/episodes[] par userId).
 * Univers connu : saisons/épisodes de la bibliothèque locale.
 * - `watched = true` STRICT : univers connu non vide ET tout vu.
 * - Univers inconnu (série jamais ajoutée) : total null, watched false —
 *   on ne fabrique JAMAIS un état vu sans données (§72 : pas de filter/CSS).
 * - Nouvel épisode découvert : absent de episodes[] → non vu → la série
 *   CESSE d'être fully watched automatiquement (§10).
 * - Le recalcul est fait sur lecture via ces fonctions ET appliqué en
 *   écriture par markSeason/markSeries (cascades parent→enfants, §13-15).
 */

export interface EpisodeRef {
  season: number;
  episode: number;
}

export interface SeasonState {
  season: number;
  watched: boolean;
  watchedCount: number;
  /** null = univers inconnu (série absente de la bibliothèque). */
  total: number | null;
}

export interface SeriesState {
  watched: boolean;
  watchedCount: number;
  total: number | null;
  seasons: SeasonState[];
}

/** Univers connu d'une série (bibliothèque locale). `season` restreint à
 *  une saison. Override injectable pour les tests (pas de store). */
export function knownEpisodes(tmdbId: number, season?: number, universe?: EpisodeRef[] | null): EpisodeRef[] {
  if (universe != null) return season == null ? [...universe] : universe.filter((e) => e.season === season);
  const series = getSeriesByTmdbId(tmdbId);
  if (!series) return [];
  const out: EpisodeRef[] = [];
  for (const s of series.seasons ?? []) {
    if (season != null && s.seasonNumber !== season) continue;
    for (const ep of s.episodes ?? []) {
      out.push({ season: s.seasonNumber, episode: ep.episodeNumber });
    }
  }
  return out;
}

export function isEpisodeWatched(
  userId: string,
  tmdbId: number,
  season: number,
  episode: number,
): boolean {
  const status = getWatchStatus(userId);
  if (!status) return false;
  return status.episodes.some((e) => e.tmdbId === tmdbId && e.season === season && e.episode === episode);
}

export function isMovieWatched(userId: string, tmdbId: number): boolean {
  return getWatchStatus(userId)?.movies.includes(tmdbId) ?? false;
}

export function seasonState(
  userId: string,
  tmdbId: number,
  season: number,
  universe?: EpisodeRef[] | null,
): SeasonState {
  const known = knownEpisodes(tmdbId, season, universe);
  const status = getWatchStatus(userId);
  const have = new Set(
    (status?.episodes ?? [])
      .filter((e) => e.tmdbId === tmdbId && e.season === season)
      .map((e) => `${e.tmdbId}.${e.season}.${e.episode}`),
  );
  const watchedCount = known.filter((e) => have.has(`${tmdbId}.${e.season}.${e.episode}`)).length;
  // Univers explicitement injecté (tests) : même vide, il fait foi.
  // Sinon, vide = série absente de la bibliothèque = inconnu, jamais vu.
  const knownTotal: number | null = universe != null || known.length > 0 ? known.length : null;
  return {
    season,
    watched: knownTotal != null && knownTotal > 0 && watchedCount >= knownTotal,
    watchedCount,
    total: knownTotal,
  };
}

export function seriesState(
  userId: string,
  tmdbId: number,
  universe?: EpisodeRef[] | null,
): SeriesState {
  const known = knownEpisodes(tmdbId, undefined, universe);
  const seasons = [...new Set(known.map((e) => e.season))].sort((a, b) => a - b);
  const states = seasons.map((s) => seasonState(userId, tmdbId, s, known));
  const watchedCount = states.reduce((n, s) => n + s.watchedCount, 0);
  const total = known.length > 0 ? known.length : null;
  return {
    watched: total != null && total > 0 && watchedCount >= total,
    watchedCount,
    total,
    seasons: states,
  };
}

/** Marquage explicite saison vue/non vue (§13) : s'applique RÉELLEMENT aux
 *  épisodes connus (pas un badge), puis la série se recalcule à la lecture.
 *  Univers vide → 0 appliqué, jamais d'état fabriqué. */
export function markSeason(
  userId: string,
  tmdbId: number,
  season: number,
  watched: boolean,
  opts?: { title?: string; at?: number; universe?: EpisodeRef[] | null },
): { applied: number; total: number | null } {
  const known = knownEpisodes(tmdbId, season, opts?.universe);
  if (known.length === 0) return { applied: 0, total: null };
  const at = opts?.at ?? Date.now();
  setWatchedEpisodes(
    userId,
    known.map((e) => ({ tmdbId, season: e.season, episode: e.episode, watchedAt: at })),
    watched,
    opts?.title ?? "",
  );
  return { applied: known.length, total: known.length };
}

/** Marquage explicite série vue/non vue (§14) : toutes les saisons et tous
 *  les épisodes connus suivent. */
export function markSeries(
  userId: string,
  tmdbId: number,
  watched: boolean,
  opts?: { title?: string; at?: number; universe?: EpisodeRef[] | null },
): { applied: number; total: number | null } {
  const known = knownEpisodes(tmdbId, undefined, opts?.universe);
  if (known.length === 0) return { applied: 0, total: null };
  const at = opts?.at ?? Date.now();
  setWatchedEpisodes(
    userId,
    known.map((e) => ({ tmdbId, season: e.season, episode: e.episode, watchedAt: at })),
    watched,
    opts?.title ?? "",
  );
  return { applied: known.length, total: known.length };
}
