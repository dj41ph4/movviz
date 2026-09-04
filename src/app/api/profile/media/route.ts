import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadWatchlist } from "@/lib/watchlist/store";
import { getAllRatings } from "@/lib/ai/tasteProfile";
import { getUserWatchHistory } from "@/lib/userContext/history";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listOnDeckEntries } from "@/lib/plex/onDeckService";

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
  const onDeck = await listOnDeckEntries(user);
  const history = getUserWatchHistory({ userId: user.id, limit: 200 });
  const ratings = getAllRatings(user.id).sort((a, b) => b.updatedAt - a.updatedAt);

  const continueWatching = onDeck.map((item) => ({
    tmdbId: item.tmdbId, type: item.type, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null,
    title: item.title, subtitle: item.type === "episode" ? item.episodeTitle ?? null : null,
    posterPath: item.posterPath, stillPath: null, year: item.year, watched: false,
    progress: item.progressPercent > 0 ? { ratio: item.progressPercent / 100 } : null,
    watchedAt: null,
  }));
  const watchHistory = history.map((item) => ({ tmdbId: item.tmdbId, type: item.mediaType, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, title: item.title, subtitle: null, posterPath: null, stillPath: null, year: null, watchedAt: item.watchedAt }));
  const ratingItems = ratings.map((item) => ({ tmdbId: item.tmdbId, type: item.type, title: item.title, userRating: item.rating, watchedAt: null, addedAt: null }));
  const watchlistItems = watchlist.map((item) => ({ tmdbId: item.tmdbId, type: item.type, seasonNumber: item.seasonNumber ?? null, episodeNumber: item.episodeNumber ?? null, title: item.title, subtitle: item.parentTitle ?? null, posterPath: item.posterPath, stillPath: item.stillPath ?? null, year: item.year, addedAt: item.addedAt }));
  return NextResponse.json({ generatedAt: Date.now(), continueWatching: continueWatching.slice(0, 12), watchHistory: watchHistory.slice(0, 20), ratings: ratingItems.slice(0, 20), watchlist: watchlistItems.slice(0, 20), counts: { continueWatching: continueWatching.length, history: watchHistory.length, ratings: ratingItems.length, watchlist: watchlistItems.length } });
}
