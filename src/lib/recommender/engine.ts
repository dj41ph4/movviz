import { getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { getWatchStatus, getAllWatchStatuses } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { MetaSearchResult } from "@/lib/metadata/types";

// A single other account's taste isn't "what the household is watching" — it's
// just cloning one specific person's picks onto someone with no Plex history
// of their own, which is worse than the plain generic fallback (looks
// personalized but silently isn't theirs). Household blending only kicks in
// once at least this many OTHER accounts have real watch data to draw from.
const HOUSEHOLD_MIN_CONTRIBUTORS = 2;
const PERSONAL_SEED_WEIGHT = 2;
const HOUSEHOLD_SEED_WEIGHT = 1;

export async function getRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  const owned = new Set<number>(
    (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId)
  );

  const status = getWatchStatus(userId);
  const personalWatched: number[] =
    type === "movie"
      ? (status?.movies ?? [])
      : [...new Set((status?.episodes ?? []).map((e) => e.tmdbId))];

  // Broaden the signal beyond this one account: other accounts' own Plex
  // watch history feeds in too (lower weight than this account's own — see
  // PERSONAL_SEED_WEIGHT/HOUSEHOLD_SEED_WEIGHT), so someone whose personal
  // history is sparse or empty still gets a real household-shaped row
  // instead of the flat generic "top rated" fallback. Never counts this
  // account's own data against itself, and never lets a lone other
  // account's data stand in as "the household" (see the constant above) —
  // this account's own row also stays exactly what it always was, since the
  // household pool only ever adds to a personal signal that's already there.
  const contributors = new Set<string>();
  const householdWatched = new Set<number>();
  for (const other of getAllWatchStatuses()) {
    if (other.userId === userId) continue;
    const ids = type === "movie" ? other.movies : [...new Set(other.episodes.map((e) => e.tmdbId))];
    if (ids.length === 0) continue;
    contributors.add(other.userId);
    for (const id of ids) householdWatched.add(id);
  }
  if (contributors.size < HOUSEHOLD_MIN_CONTRIBUTORS) householdWatched.clear();
  for (const id of personalWatched) householdWatched.delete(id);

  if (personalWatched.length < 3 && householdWatched.size < 3) return [];

  const excluded = new Set<number>([...personalWatched, ...owned]);
  const seeds: { id: number; weight: number }[] = [
    ...personalWatched.slice(0, 25).map((id) => ({ id, weight: PERSONAL_SEED_WEIGHT })),
    ...[...householdWatched].slice(0, 15).map((id) => ({ id, weight: HOUSEHOLD_SEED_WEIGHT })),
  ];

  const fetchFn = type === "movie" ? getMovieRecommendations : getTvRecommendations;
  const results = await mapWithConcurrency(seeds, 5, async (seed) => {
    try {
      const r = await fetchFn(seed.id);
      return r ? { weight: seed.weight, results: r.results } : null;
    } catch { return null; }
  });

  const score = new Map<number, { item: MetaSearchResult; count: number }>();
  for (const r of results) {
    if (!r) continue;
    for (const item of r.results) {
      if (excluded.has(item.tmdbId)) continue;
      const existing = score.get(item.tmdbId);
      if (existing) {
        existing.count += r.weight;
      } else {
        score.set(item.tmdbId, { item, count: r.weight });
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
