import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listPlaybackProgress, type PlaybackProgress } from "@/lib/playback/progressStore";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getUserContextHealth } from "./database";
import { syncPlaybackContext } from "./ingest";
import type {
  CurrentWatchingContextItem,
  RecentWatchedContextItem,
  SeriesProgressContext,
  UnifiedUserContextSnapshot,
} from "./types";

function clampLimit(limit: number, max: number): number {
  return Math.max(1, Math.min(max, Math.round(limit || 1)));
}

function genresFor(tmdbId: number, type: "movie" | "series"): string[] {
  const item = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  const genres = item && Array.isArray((item as { genres?: string[] }).genres)
    ? (item as { genres: string[] }).genres
    : [];
  return genres.filter((genre) => typeof genre === "string" && genre.trim().length > 0);
}

function titleForSeries(tmdbId: number, fallback = ""): string {
  return getSeriesByTmdbId(tmdbId)?.title ?? (fallback || `#${tmdbId}`);
}

function currentItem(progress: PlaybackProgress): CurrentWatchingContextItem | null {
  if (progress.tmdbId == null) return null;
  const durationMs = Math.max(0, progress.durationMs || 0);
  const positionMs = Math.max(0, progress.resumeOffsetMs ?? progress.lastPositionMs ?? 0);
  return {
    tmdbId: progress.tmdbId,
    mediaType: progress.mediaType,
    title: progress.mediaType === "episode"
      ? titleForSeries(progress.tmdbId, progress.title ?? "")
      : (progress.title ?? getMovieByTmdbId(progress.tmdbId)?.title ?? `#${progress.tmdbId}`),
    seasonNumber: progress.seasonNumber,
    episodeNumber: progress.episodeNumber,
    positionMs,
    durationMs,
    progressRatio: durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0,
    lastPlayedAt: progress.lastPlayedAt,
  };
}

export function getCurrentWatchingContext(userId: string, limit = 8): CurrentWatchingContextItem[] {
  const max = clampLimit(limit, 20);
  const raw = listPlaybackProgress(userId)
    .slice()
    .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))
    .slice(0, max);

  const items: CurrentWatchingContextItem[] = [];
  for (const progress of raw) {
    syncPlaybackContext(progress);
    const item = currentItem(progress);
    if (item) items.push(item);
  }
  return items;
}

export function getRecentWatchedContext(userId: string, limit = 12): RecentWatchedContextItem[] {
  const max = clampLimit(limit, 30);
  const recent = (getWatchStatus(userId)?.recent ?? [])
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, max);

  return recent.map((entry) => ({
    tmdbId: entry.tmdbId,
    mediaType: entry.type,
    title: entry.title || (entry.type === "movie"
      ? getMovieByTmdbId(entry.tmdbId)?.title
      : getSeriesByTmdbId(entry.tmdbId)?.title) || `#${entry.tmdbId}`,
    watchedAt: entry.at,
    genres: genresFor(entry.tmdbId, entry.type),
  }));
}

export function getSeriesProgressContext(userId: string, tmdbId: number, seasonNumber?: number): SeriesProgressContext | null {
  const watch = getWatchStatus(userId);
  const series = getSeriesByTmdbId(tmdbId);
  const title = series?.title ?? `#${tmdbId}`;
  const completed = (watch?.episodes ?? [])
    .filter((episode) => episode.tmdbId === tmdbId && (seasonNumber == null || episode.season === seasonNumber))
    .slice()
    .sort((a, b) => a.season - b.season || a.episode - b.episode);

  const active = listPlaybackProgress(userId)
    .filter((progress) => progress.mediaType === "episode" && progress.tmdbId === tmdbId &&
      progress.seasonNumber != null && progress.episodeNumber != null &&
      (seasonNumber == null || progress.seasonNumber === seasonNumber))
    .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))[0] ?? null;

  if (!series && completed.length === 0 && !active) return null;

  const inferredSeason = seasonNumber ?? active?.seasonNumber ?? completed.at(-1)?.season ?? null;
  const lastCompletedRaw = completed.at(-1) ?? null;
  const lastCompleted = lastCompletedRaw ? { season: lastCompletedRaw.season, episode: lastCompletedRaw.episode } : null;

  let current: SeriesProgressContext["current"] = null;
  if (active && active.seasonNumber != null && active.episodeNumber != null) {
    syncPlaybackContext(active);
    const durationMs = Math.max(0, active.durationMs || 0);
    const positionMs = Math.max(0, active.resumeOffsetMs ?? active.lastPositionMs ?? 0);
    current = {
      season: active.seasonNumber,
      episode: active.episodeNumber,
      positionMs,
      durationMs,
      progressRatio: durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0,
      lastPlayedAt: active.lastPlayedAt,
    };
  }

  let next: SeriesProgressContext["next"] = null;
  if (inferredSeason != null) {
    const nextEpisodeNumber = current?.season === inferredSeason
      ? current.episode + 1
      : lastCompleted?.season === inferredSeason
        ? lastCompleted.episode + 1
        : 1;
    const season = series?.seasons.find((item) => item.seasonNumber === inferredSeason);
    const episode = season?.episodes.find((item) => item.episodeNumber === nextEpisodeNumber);
    const total = season?.episodes.length ?? null;
    if (total == null || nextEpisodeNumber <= total) {
      next = { season: inferredSeason, episode: nextEpisodeNumber, title: episode?.title };
    }
  }

  let seasonStats: SeriesProgressContext["seasonStats"] = null;
  if (inferredSeason != null) {
    const watched = (watch?.episodes ?? []).filter((episode) => episode.tmdbId === tmdbId && episode.season === inferredSeason).length;
    const total = series?.seasons.find((item) => item.seasonNumber === inferredSeason)?.episodes.length ?? null;
    seasonStats = { season: inferredSeason, watched, total };
  }

  return {
    tmdbId,
    title,
    seasonNumber: inferredSeason,
    completedEpisodes: completed.length,
    lastCompleted,
    current,
    next,
    seasonStats,
  };
}

export function buildUnifiedUserContextSnapshot(userId: string): UnifiedUserContextSnapshot {
  const recentWatched = getRecentWatchedContext(userId, 15);
  const currentWatching = getCurrentWatchingContext(userId, 8);
  const ids = new Set<number>();
  for (const item of currentWatching) {
    if (item.mediaType === "episode") ids.add(item.tmdbId);
  }
  for (const item of recentWatched) {
    if (item.mediaType === "series") ids.add(item.tmdbId);
    if (ids.size >= 5) break;
  }
  const seriesProgress = [...ids]
    .slice(0, 5)
    .map((tmdbId) => getSeriesProgressContext(userId, tmdbId))
    .filter((item): item is SeriesProgressContext => item !== null);

  return {
    recentWatched,
    currentWatching,
    seriesProgress,
    generatedAt: Date.now(),
    storageAvailable: getUserContextHealth().database === "ok",
  };
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatUnifiedUserContext(snapshot: UnifiedUserContextSnapshot): string {
  const parts: string[] = [];
  if (snapshot.currentWatching.length) {
    parts.push(`reprises vérifiées : ${snapshot.currentWatching.map((item) => {
      const episode = item.mediaType === "episode" && item.seasonNumber != null && item.episodeNumber != null
        ? ` S${String(item.seasonNumber).padStart(2, "0")}E${String(item.episodeNumber).padStart(2, "0")}`
        : "";
      const progress = item.durationMs > 0
        ? ` ${formatClock(item.positionMs)}/${formatClock(item.durationMs)} (${Math.round(item.progressRatio * 100)}%)`
        : "";
      return `${item.title}${episode}${progress}`;
    }).join(" ; ")}`);
  }
  if (snapshot.seriesProgress.length) {
    parts.push(`progression séries vérifiée : ${snapshot.seriesProgress.map((series) => {
      const season = series.seasonNumber != null ? `S${String(series.seasonNumber).padStart(2, "0")}` : "saison inconnue";
      const completed = series.lastCompleted
        ? `dernier fini ${season}E${String(series.lastCompleted.episode).padStart(2, "0")}`
        : "aucun épisode terminé identifié";
      const current = series.current
        ? `en cours ${season}E${String(series.current.episode).padStart(2, "0")} ${formatClock(series.current.positionMs)}/${formatClock(series.current.durationMs)} (${Math.round(series.current.progressRatio * 100)}%)`
        : "pas d'épisode en reprise";
      const count = series.seasonStats
        ? `${series.seasonStats.watched}${series.seasonStats.total != null ? `/${series.seasonStats.total}` : ""} vus dans ${season}`
        : `${series.completedEpisodes} épisodes vus`;
      return `${series.title}: ${completed}, ${current}, ${count}`;
    }).join(" ; ")}`);
  }
  if (snapshot.recentWatched.length) {
    parts.push(`dernières vues datées : ${snapshot.recentWatched.map((item) => {
      const genre = item.genres.length ? ` [${item.genres.slice(0, 3).join("/")}]` : "";
      return `${item.title}${genre} @${new Date(item.watchedAt).toISOString()}`;
    }).join(" ; ")}`);
  }
  return parts.join(" · ");
}
