import type { MetaSearchResult } from "@/lib/metadata/types";

// TMDb's shared "Documentary" genre id (same numeric id for movies and TV).
// Confirmed live: TMDb's /recommendations, /similar and a favorite actor's
// own combined_credits routinely mix in documentaries and "making of"
// specials about a title/person — genuine TMDb entries, but never what
// "Suggestions pour vous" or "Parce que vous avez regardé" means. The user
// explicitly rejected these with 👎 already; the affinity engine only ever
// SOFTENS a genre's score from that (userContext/taste.ts), it never hard-
// excludes a whole genre, so this is a deliberate hard rule instead — priority
// is fiction (film/série), a documentary should never be a "pick" here.
const DOCUMENTARY_GENRE_ID = 99;

/**
 * Filters a "suggestion" row (Dashboard recommendations, Discover editorial
 * rows) down to titles actually worth recommending: a 0 rating means TMDb
 * has no real votes yet (almost always an unreleased or just-added title
 * whose vote_average defaults to 0, not a genuinely bad film), a future
 * release date means it can't be watched yet, and a documentary/making-of
 * isn't fiction — all read as "why is this being suggested to me" rather
 * than a real pick.
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
    if (r.genreIds?.includes(DOCUMENTARY_GENRE_ID)) return false;
    if (r.releaseDate) {
      const t = new Date(r.releaseDate).getTime();
      if (!Number.isNaN(t) && t > now) return false;
    }
    return true;
  });
}
