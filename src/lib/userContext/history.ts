import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { withUserContextDb } from "./database";

export interface UserWatchHistoryItem {
  tmdbId: number;
  mediaType: "movie" | "series";
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAt: number;
  genres: string[];
  source: "context_ledger" | "legacy_recent";
}

export interface UserWatchHistoryQuery {
  userId: string;
  mediaType?: "movie" | "series";
  genre?: string;
  since?: number;
  until?: number;
  limit?: number;
}

interface HistoryRow {
  tmdb_id: number;
  media_type: string | null;
  season_number: number | null;
  episode_number: number | null;
  title_snapshot: string | null;
  occurred_at: number;
}

function genresFor(tmdbId: number, type: "movie" | "series"): string[] {
  const item = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  const genres = item && Array.isArray((item as { genres?: string[] }).genres)
    ? (item as { genres: string[] }).genres
    : [];
  return genres.filter((genre) => typeof genre === "string" && genre.trim().length > 0);
}

function titleFor(tmdbId: number, type: "movie" | "series", fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim();
  return type === "movie"
    ? getMovieByTmdbId(tmdbId)?.title ?? `#${tmdbId}`
    : getSeriesByTmdbId(tmdbId)?.title ?? `#${tmdbId}`;
}

function fromLedger(userId: string, max: number): UserWatchHistoryItem[] {
  return withUserContextDb((db) => {
    const rows = db.prepare(`
      SELECT tmdb_id, media_type, season_number, episode_number, title_snapshot, occurred_at
      FROM context_events
      WHERE user_id = ?
        AND tmdb_id IS NOT NULL
        AND event_type IN ('movie_completed', 'episode_completed', 'watched_marked')
      ORDER BY occurred_at DESC
      LIMIT ?
    `).all(userId, max) as unknown as HistoryRow[];

    return rows.flatMap((row): UserWatchHistoryItem[] => {
      const type: "movie" | "series" = row.media_type === "movie" ? "movie" : "series";
      if (!Number.isFinite(row.tmdb_id) || !Number.isFinite(row.occurred_at)) return [];
      return [{
        tmdbId: Number(row.tmdb_id),
        mediaType: type,
        title: titleFor(Number(row.tmdb_id), type, row.title_snapshot),
        seasonNumber: row.media_type === "episode" ? row.season_number : null,
        episodeNumber: row.media_type === "episode" ? row.episode_number : null,
        watchedAt: Number(row.occurred_at),
        genres: genresFor(Number(row.tmdb_id), type),
        source: "context_ledger",
      }];
    });
  }, []);
}

function fromLegacy(userId: string): UserWatchHistoryItem[] {
  return (getWatchStatus(userId)?.recent ?? []).map((entry) => ({
    tmdbId: entry.tmdbId,
    mediaType: entry.type,
    title: titleFor(entry.tmdbId, entry.type, entry.title),
    seasonNumber: null,
    episodeNumber: null,
    watchedAt: entry.at,
    genres: genresFor(entry.tmdbId, entry.type),
    source: "legacy_recent" as const,
  }));
}

function nearDuplicate(a: UserWatchHistoryItem, b: UserWatchHistoryItem): boolean {
  if (a.tmdbId !== b.tmdbId || a.mediaType !== b.mediaType) return false;
  // Never collapse two ledger entries: they are independently identified,
  // append-only events and can legitimately represent rewatches, even close
  // together. De-duplication exists ONLY to hide the legacy `recent` mirror
  // of an event that is already present in the new ledger.
  if (a.source === b.source) return false;
  if (Math.abs(a.watchedAt - b.watchedAt) > 120_000) return false;
  // A legacy series-level recent marker has no episode coordinates. It is
  // considered the same viewing event as an exact episode completion close
  // in time. When both sides are exact, only the same episode can match.
  if (a.mediaType === "series") {
    const bothExact = a.seasonNumber != null && a.episodeNumber != null && b.seasonNumber != null && b.episodeNumber != null;
    if (bothExact) return a.seasonNumber === b.seasonNumber && a.episodeNumber === b.episodeNumber;
  }
  return true;
}

/**
 * Unified, per-user chronological watch history.
 *
 * Future Movviz playback comes from the append-only ledger (so rewatches are
 * preserved). The bounded legacy `recent` list is merged only as a migration
 * fallback. Only legacy↔ledger mirrors close in time are de-duplicated; two
 * real ledger events are never collapsed together.
 */
export function getUserWatchHistory(query: UserWatchHistoryQuery): UserWatchHistoryItem[] {
  const requested = Math.max(1, Math.min(200, Math.round(query.limit ?? 30)));
  const scanLimit = Math.min(1000, Math.max(requested * 5, 100));
  const combined = [...fromLedger(query.userId, scanLimit), ...fromLegacy(query.userId)]
    .filter((item) => query.mediaType == null || item.mediaType === query.mediaType)
    .filter((item) => query.since == null || item.watchedAt >= query.since)
    .filter((item) => query.until == null || item.watchedAt <= query.until)
    .filter((item) => {
      if (!query.genre?.trim()) return true;
      const wanted = query.genre.trim().toLocaleLowerCase("fr");
      return item.genres.some((genre) => genre.toLocaleLowerCase("fr") === wanted || genre.toLocaleLowerCase("fr").includes(wanted));
    })
    .sort((a, b) => b.watchedAt - a.watchedAt);

  const deduped: UserWatchHistoryItem[] = [];
  for (const item of combined) {
    if (deduped.some((existing) => nearDuplicate(existing, item))) continue;
    deduped.push(item);
    if (deduped.length >= requested) break;
  }
  return deduped;
}

export function formatUserWatchHistory(userId: string, limit = 30): string {
  const history = getUserWatchHistory({ userId, limit });
  if (!history.length) return "";
  return history.map((item) => {
    const episode = item.mediaType === "series" && item.seasonNumber != null && item.episodeNumber != null
      ? ` S${String(item.seasonNumber).padStart(2, "0")}E${String(item.episodeNumber).padStart(2, "0")}`
      : "";
    const genres = item.genres.length ? ` [${item.genres.slice(0, 4).join("/")}]` : "";
    return `${item.title}${episode}${genres} @${new Date(item.watchedAt).toISOString()}`;
  }).join(" ; ");
}
