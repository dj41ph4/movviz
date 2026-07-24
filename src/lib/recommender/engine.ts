import { getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";

export async function getRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  const status = getWatchStatus(userId);
  if (!status) return [];

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

  const entries = [...score.values()];
  const maxCount = Math.max(1, ...entries.map((s) => s.count));

  return entries
    .map((s) => ({
      item: s.item,
      composite:
        (s.count / maxCount) * 0.3
        + (Math.min(s.item.rating ?? 0, 10) / 10) * 0.35
        + (Math.min(Math.max((s.item.year ?? 2000) - 2000, 0), 30) / 30) * 0.35,
    }))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 200)
    .map((s) => s.item);
}
