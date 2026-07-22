/**
 * Curated studio/network tiles for the Discover home rows — TMDb numeric
 * company/network IDs are public catalog data (not creative content), same
 * category of fact as a genre ID. Logo art is fetched live from TMDb per ID
 * (see getCompanyLogo/getNetworkLogo) and falls back to a text badge if
 * TMDb has no logo for a given one.
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

export const TV_NETWORKS = [
  { id: 213, name: "Netflix" },
  { id: 49, name: "HBO" },
  { id: 2739, name: "Disney+" },
  { id: 1024, name: "Amazon Prime Video" },
  { id: 2552, name: "Apple TV+" },
  { id: 453, name: "Hulu" },
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
