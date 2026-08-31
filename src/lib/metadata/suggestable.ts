import type { MetaSearchResult } from "@/lib/metadata/types";

/**
 * Filters a "suggestion" row (Dashboard recommendations, Discover editorial
 * rows) down to titles actually worth recommending: a 0 rating means TMDb
 * has no real votes yet (almost always an unreleased or just-added title
 * whose vote_average defaults to 0, not a genuinely bad film), and a future
 * release date means it can't be watched yet — both read as "why is this
 * being suggested to me" rather than a real pick.
 *
 * Deliberately NOT applied to rows whose entire purpose is showing
 * unreleased content ("upcoming", "upcomingVod", the Dashboard's own
 * upcoming-releases pool) — callers building one of those keep using the
 * raw results.
 */
export function filterSuggestable(results: MetaSearchResult[]): MetaSearchResult[] {
  const now = Date.now();
  return results.filter((r) => {
    if (r.rating === 0) return false;
    if (r.releaseDate) {
      const t = new Date(r.releaseDate).getTime();
      if (!Number.isNaN(t) && t > now) return false;
    }
    return true;
  });
}
