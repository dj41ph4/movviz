/**
 * Curated studio tiles for the Discover home rows — TMDb numeric company
 * IDs are public catalog data (not creative content), same category of
 * fact as a genre ID. Logo art is fetched live from TMDb per ID (see
 * getCompanyLogo) and falls back to a text badge if TMDb has no logo for
 * a given one.
 */
export const MOVIE_STUDIOS = [
  { id: 2, name: "Walt Disney Pictures" },
  { id: 420, name: "Marvel Studios" },
  { id: 429, name: "DC" },
  { id: 174, name: "Warner Bros. Pictures" },
  { id: 33, name: "Universal Pictures" },
  { id: 4, name: "Paramount Pictures" },
  { id: 5, name: "Columbia Pictures" },
  { id: 25, name: "20th Century Studios" },
  { id: 41077, name: "A24" },
];

/**
 * Curated streaming-platform tiles for Discover's "Plateformes" row — fixed
 * TMDb watch-provider IDs, same explicit-ID approach as MOVIE_STUDIOS
 * above, deliberately NOT a substring match against TMDb's live provider
 * list. That fuzzy approach was tried first and broke in practice: TMDb's
 * FR watch-provider list is mostly Amazon "Channel" add-ons and VOD stores
 * (e.g. "Action Max Amazon Channel", "DOCSVILLE" — both contain "max"/"ocs"
 * as a bare substring), so a pattern like "Max" or "OCS" silently matched
 * the wrong, obscure entry instead of the real service. IDs verified live
 * against GET /watch/providers/movie?watch_region=FR, picked from its own
 * display_priorities.FR ranking (lower = more prominent in France) minus
 * pure rental/purchase stores (Apple TV Store, Google Play Movies…) and
 * non-platform aggregator entries (JustWatch TV) — those aren't streaming
 * platforms in the sense this row means.
 */
export const STREAMING_PLATFORMS = [
  { id: 8, name: "Netflix" },
  { id: 119, name: "Amazon Prime Video" },
  { id: 350, name: "Apple TV" },
  { id: 337, name: "Disney Plus" },
  { id: 283, name: "Crunchyroll" },
  { id: 381, name: "Canal+" },
  { id: 234, name: "Arte" },
  { id: 147, name: "M6+" },
  { id: 192, name: "YouTube" },
  { id: 11, name: "MUBI" },
];

/** Cycled background gradients for genre tiles — brand palette, no external images needed. */
export const GENRE_GRADIENTS = [
  "from-brand to-brand-2",
  "from-cyan/80 to-brand/80",
  "from-magenta/80 to-brand-2/80",
  "from-amber/70 to-magenta/70",
  "from-lime/70 to-cyan/70",
  "from-brand-2 to-magenta",
  "from-cyan to-lime/80",
  "from-brand to-cyan/80",
];
