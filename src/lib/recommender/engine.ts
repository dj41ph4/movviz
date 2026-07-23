import { getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";

/**
 * Build personalised recommendations for a user based on their Plex watch
 * history. Supports both movies and series.
 *
 * Strategy:
 *   1. Fetch TMDB recommendations for every watched movie/series (capped at 25).
 *   2. Score each candidate by how many watched items recommended it.
 *   3. Exclude already-watched and already-owned items.
 *   4. Return top 40, sorted by score descending.
 *
 * Returns empty list if the user has fewer than 3 watched items (too weak a
 * signal — the homepage already has plenty of rows).
 */
export async function getRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  const status = getWatchStatus(userId);
  if (!status) return [];

  // Anything already in the library shouldn't be suggested again, watched or not
  // (e.g. downloading, or added but not watched yet).
  const owned = new Set<number>(
    (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId)
  );

  const watched = new Set<number>();
  let seeds: number[];

  if (type === "movie") {
    if (status.movies.length < 3) return [];
    for (const id of status.movies) watched.add(id);
    seeds = status.movies.slice(0, 25);
  } else {
    const seriesIds = [...new Set(status.episodes.map((e) => e.tmdbId))];
    if (seriesIds.length < 3) return [];
    for (const id of seriesIds) watched.add(id);
    seeds = seriesIds.slice(0, 25);
  }

  const fetchFn = type === "movie" ? getMovieRecommendations : getTvRecommendations;
  const results = await mapWithConcurrency(seeds, 5, async (id) => {
    try { return await fetchFn(id); } catch { return null; }
  });

  const score = new Map<number, { item: MetaSearchResult; count: number }>();
  for (const r of results) {
    if (!r) continue;
    for (const item of r.results) {
      if (watched.has(item.tmdbId) || owned.has(item.tmdbId)) continue;
      const existing = score.get(item.tmdbId);
      if (existing) {
        existing.count++;
      } else {
        score.set(item.tmdbId, { item, count: 1 });
      }
    }
  }

  return [...score.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map((s) => s.item);
}
