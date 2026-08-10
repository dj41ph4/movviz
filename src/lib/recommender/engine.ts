import { getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";

// Strictly per-account: this row is built ONLY from the target account's own
// Plex watch history — never blended with what any other account has
// watched, even a single other title. Two accounts on the same instance must
// never influence each other's "for you" row. Confirmed explicitly with the
// user after an earlier attempt at cross-account blending — even a single
// watched title of one's own is used as a real (if narrow) personal seed
// rather than falling back to a generic list once there's at least one.
export async function getRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  const owned = new Set<number>(
    (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId)
  );

  const status = getWatchStatus(userId);
  const watched: number[] =
    type === "movie"
      ? (status?.movies ?? [])
      : [...new Set((status?.episodes ?? []).map((e) => e.tmdbId))];

  if (watched.length === 0) return [];

  const excluded = new Set<number>([...watched, ...owned]);
  const seeds = watched.slice(0, 25);

  const fetchFn = type === "movie" ? getMovieRecommendations : getTvRecommendations;
  const results = await mapWithConcurrency(seeds, 5, async (id) => {
    try { return await fetchFn(id); } catch { return null; }
  });

  const score = new Map<number, { item: MetaSearchResult; count: number }>();
  for (const r of results) {
    if (!r) continue;
    for (const item of r.results) {
      if (excluded.has(item.tmdbId)) continue;
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
