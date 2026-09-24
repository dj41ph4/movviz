/**
 * Pont films ↔ séries pour « Sélection pour vous » : TMDb ne relie jamais une
 * série à des films (ni l'inverse) — /recommendations et /similar restent
 * dans le même type. Sans pont, quelqu'un qui regarde surtout des séries
 * (anime, policier…) recevait des films choisis à partir de ses 3-4 seuls
 * films vus. On traduit donc le registre d'un titre vu (genres + langue
 * d'origine) en recherche de l'autre type.
 *
 * Les listes de genres TMDb diffèrent entre films et séries : la série
 * fusionne « Action & Aventure », « Science-Fiction & Fantastique »,
 * « Guerre & Politique », et n'a ni Horreur, ni Romance, ni Thriller.
 */

const TV_TO_MOVIE: Record<number, number[]> = {
  10759: [28, 12], // Action & Adventure → Action, Aventure
  16: [16], // Animation
  35: [35], // Comédie
  80: [80], // Crime
  99: [99], // Documentaire
  18: [18], // Drame
  10751: [10751], // Familial
  10762: [10751], // Kids → Familial
  9648: [9648], // Mystère
  10765: [878, 14], // Sci-Fi & Fantasy → Science-Fiction, Fantastique
  10768: [10752], // War & Politics → Guerre
  37: [37], // Western
};

const MOVIE_TO_TV: Record<number, number[]> = {
  28: [10759], // Action
  12: [10759], // Aventure
  16: [16],
  35: [35],
  80: [80],
  99: [99],
  18: [18],
  10751: [10751],
  14: [10765], // Fantastique
  878: [10765], // Science-Fiction
  9648: [9648],
  53: [9648], // Thriller → Mystère (le plus proche côté séries)
  10752: [10768], // Guerre
  37: [37],
};

/** Genres trop larges pour cibler seuls un registre : jamais utilisés en premier. */
const BROAD = new Set([18, 35]);

/**
 * Filtres de recherche (type cible) qui retrouvent le registre d'un titre vu
 * de l'autre type, ou null s'il n'y a rien d'assez précis à traduire.
 * Au plus deux genres, combinés en ET — un seul genre large (« Drame »)
 * ramènerait n'importe quel titre populaire. La langue d'origine n'est
 * gardée que hors anglais : c'est elle qui distingue un anime d'un dessin
 * animé américain, un drama coréen d'un soap.
 */
export function crossTypeBridgeFilters(
  seedType: "movie" | "series",
  profile: { genreIds: number[]; originalLanguage: string | null }
): { genre: string; originalLanguage?: string } | null {
  const table = seedType === "series" ? TV_TO_MOVIE : MOVIE_TO_TV;
  const mapped: number[] = [];
  for (const id of profile.genreIds) {
    for (const target of table[id] ?? []) if (!mapped.includes(target)) mapped.push(target);
  }
  const specific = mapped.filter((id) => !BROAD.has(id));
  const broad = mapped.filter((id) => BROAD.has(id));
  const language = profile.originalLanguage && profile.originalLanguage !== "en" ? profile.originalLanguage : undefined;
  // Un genre précis suffit ; un genre large seul n'est acceptable que
  // lorsque la langue d'origine resserre déjà le registre.
  if (specific.length === 0 && !(broad.length > 0 && language)) return null;
  const picked = [...specific, ...broad].slice(0, 2);
  return { genre: picked.join(","), ...(language ? { originalLanguage: language } : {}) };
}
