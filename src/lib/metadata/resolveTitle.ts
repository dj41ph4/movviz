import { searchMulti } from "@/lib/metadata/tmdb";
import { titleSimilarity } from "@/lib/library/matching";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";

/**
 * Deterministic title → TMDb match, no LLM involved at any point — pure
 * search + fuzzy-string scoring (same matcher already proven for release↔
 * library matching). Deliberately kept OUT of src/lib/ai/ despite an
 * equivalent (resolveAiItem, actions.ts) existing there for the chat
 * feature: a consumer like Netflix import must never look coupled to
 * "Movviz AI" or its enabled/disabled toggle — this works identically
 * whether the AI feature is on or off, and nothing here ever reads
 * ai.json's config. The two copies are intentionally independent rather
 * than one importing the other, so a future change to the AI feature's
 * matching behavior can never silently affect Netflix import or vice versa.
 */

export interface ResolvedTitleItem {
  title: string;
  year?: number;
  type: "movie" | "series";
  tmdbId: number;
  overview: string;
  posterPath: string | null;
  rating: number;
  inLibrary: boolean;
}

export interface TitleQuery {
  title: string;
  year?: number;
  type?: "movie" | "series";
}

/** Small bounded-concurrency helper (TMDb free tier — AGENTS.md: limit concurrency). */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// TMDb's own relevance ranking isn't trusted enough to grab the top hit
// automatically — a lexically-similar but unrelated title can legitimately
// outrank the real one (confirmed live for the AI feature's own matching:
// "un homme un vrai" → the unrelated Spanish film "Todo un hombre").
const MIN_MATCH_SCORE = 0.45;

/** Resolves a raw title against TMDb, scoring EVERY hit against the
 *  requested title instead of trusting TMDb's own top result. Returns null
 *  when nothing scores confidently — "not found" beats silently matching
 *  the wrong title. */
export async function resolveTitleAgainstTmdb(item: TitleQuery): Promise<ResolvedTitleItem | null> {
  try {
    const res = await searchMulti(item.title, 1);
    if (!res.results.length) return null;
    let hits = res.results;
    if (item.type) hits = hits.filter((r) => r.type === item.type);
    if (!hits.length) hits = res.results;

    const scored = hits
      .map((r) => ({ hit: r, score: titleSimilarity(item.title, r.title) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0].score < MIN_MATCH_SCORE) return null;
    const confident = scored.filter((s) => s.score >= MIN_MATCH_SCORE).map((s) => s.hit);

    let pick = confident[0];
    if (item.year) {
      const yearMatch = confident.find((r) => Math.abs((r.year ?? 0) - (item.year ?? 0)) <= 1);
      if (yearMatch) pick = yearMatch;
    }
    const inLibrary = pick.type === "movie" ? !!getMovieByTmdbId(pick.tmdbId) : !!getSeriesByTmdbId(pick.tmdbId);
    return {
      title: pick.title,
      year: pick.year ?? undefined,
      type: pick.type,
      tmdbId: pick.tmdbId,
      overview: pick.overview,
      posterPath: pick.posterPath,
      rating: pick.rating,
      inLibrary,
    };
  } catch {
    return null;
  }
}
