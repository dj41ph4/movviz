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
// "TV" chez TMDb ne veut pas dire série fiction : les cérémonies, journaux,
// talk-shows et téléréalités arrivent tous avec type=tv. Movviz ne les traite
// jamais comme des séries à proposer, quelle que soit la plateforme qui a
// fourni la rangée (TMDb, Plex, recommandations personnelles ou partenaire).
const NON_FICTION_TV_GENRE_IDS = new Set([10763 /* News */, 10764 /* Reality */, 10767 /* Talk */]);
const AWARD_OR_EVENT_TITLE = /\b(?:oscars?|academy\s+awards?|golden\s+globes?|emmys?|grammys?|c[ée]sar|bafta|palme\s+d['’]or|cannes|remise\s+des\s+prix|awards?\s+(?:show|ceremony))\b/i;

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
    if (r.genreIds?.some((id) => NON_FICTION_TV_GENRE_IDS.has(id))) return false;
    // Certains catalogues externes ne transmettent pas les genreIds TMDb.
    // Le titre est alors le seul signal fiable pour écarter une cérémonie,
    // plutôt que de la laisser contourner la même règle de recommandation.
    if (AWARD_OR_EVENT_TITLE.test(r.title)) return false;
    if (r.releaseDate) {
      const t = new Date(r.releaseDate).getTime();
      if (!Number.isNaN(t) && t > now) return false;
    }
    return true;
  });
}
