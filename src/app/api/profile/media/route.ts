import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadWatchlist } from "@/lib/watchlist/store";
import { getAllRatings } from "@/lib/ai/tasteProfile";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { getUserWatchHistory } from "@/lib/userContext/history";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";

export const dynamic = "force-dynamic";

function titleFor(tmdbId: number, type: "movie" | "series" | "episode", fallback?: string | null): string {
  if (fallback) return fallback;
  if (type === "movie") return getMovieByTmdbId(tmdbId)?.title ?? `#${tmdbId}`;
  return getSeriesByTmdbId(tmdbId)?.title ?? `#${tmdbId}`;
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const watchlist = loadWatchlist(user.id);
  const progress = listPlaybackProgress(user.id).filter((item) => item.tmdbId != null && item.durationMs > 0 && !item.watched)
    .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt));
  const history = getUserWatchHistory({ userId: user.id, limit: 200 });
  const ratings = getAllRatings(user.id).sort((a, b) => b.updatedAt - a.updatedAt);

  const continueWatching = progress.map((item) => ({
    tmdbId: item.tmdbId!, type: item.mediaType, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null,
    title: titleFor(item.tmdbId!, item.mediaType, item.title), subtitle: item.mediaType === "episode" ? item.title : null,
    posterPath: null, stillPath: null, year: null, watched: item.watched,
    progress: { positionMs: item.resumeOffsetMs ?? item.lastPositionMs ?? 0, durationMs: item.durationMs, ratio: Math.max(0, Math.min(1, (item.resumeOffsetMs ?? item.lastPositionMs ?? 0) / item.durationMs)) },
    watchedAt: item.watchedAt ?? null,
  }));
  const watchHistory = history.map((item) => ({ tmdbId: item.tmdbId, type: item.mediaType, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, title: item.title, subtitle: null, posterPath: null, stillPath: null, year: null, watchedAt: item.watchedAt }));
  const ratingItems = ratings.map((item) => ({ tmdbId: item.tmdbId, type: item.type, title: item.title, userRating: item.rating, watchedAt: null, addedAt: null }));
  const watchlistItems = watchlist.map((item) => ({ tmdbId: item.tmdbId, type: item.type, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null, title: item.title, subtitle: item.parentTitle ?? null, posterPath: item.posterPath, stillPath: item.stillPath ?? null, year: item.year, addedAt: item.addedAt }));
  return NextResponse.json({ generatedAt: Date.now(), continueWatching: continueWatching.slice(0, 12), watchHistory: watchHistory.slice(0, 20), ratings: ratingItems.slice(0, 20), watchlist: watchlistItems.slice(0, 20), counts: { continueWatching: continueWatching.length, history: watchHistory.length, ratings: ratingItems.length, watchlist: watchlistItems.length } });
}
