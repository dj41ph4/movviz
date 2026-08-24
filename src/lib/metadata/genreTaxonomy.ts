/**
 * Two genres TMDb has no official id for, made navigable the same way as
 * every real genre — one shared rule per genre, used both to build the
 * Discover rows/genre-filter results (list-level TMDb data: numeric genre
 * ids + original_language, always reliable) and to filter the user's own
 * library (LibraryMovie/LibrarySeries store genre NAMES, in whatever
 * locale was active when the title was added — French in practice for
 * this app, see getGenres()'s own fr-FR default in tmdb.ts).
 *
 * Anime: origin_country is TV-only at the TMDb list level (movies never
 * carry it outside a full /movie/{id} detail fetch, which the existing
 * MetaDetail.isAnime flag already uses) — original_language is available
 * on every list item for BOTH media types, and is the more reliable signal
 * here, so this is a deliberately different (list-friendly) rule from
 * MetaDetail.isAnime, not a replacement of it.
 *
 * Teen/romance: TMDb's TV genre vocabulary has no "Romance" id at all
 * (confirmed live against GET /genre/tv/list — Action & Adventure, Crime,
 * Mystery, Sci-Fi & Fantasy, Soap, War & Politics... no Romance). "Soap"
 * is TMDb's own bucket for relationship-driven serialized drama and is the
 * closest real analog; Drama+Comedy together is the fallback signal.
 */

export const ANIME_GENRE_ID = "anime";
export const TEEN_GENRE_ID = "teen";

/** Curated genre-highlight rows for Discover — shared between
 *  /api/metadata/rows (home page) and /api/metadata/row-page ("see all"
 *  pagination), so the two never drift out of sync. Ids differ between
 *  media types (TMDb's TV vocabulary has no bare "Action" or "Horror"/
 *  "Thriller" id — "Action & Adventure" is the closest TV analog, and
 *  horror/thriller only exist as movie genres). */
export const GENRE_ROWS: { key: string; movie: number; series: number | null }[] = [
  { key: "genreAction", movie: 28, series: 10759 },
  { key: "genreComedy", movie: 35, series: 35 },
  { key: "genreHorror", movie: 27, series: null },
  { key: "genreSciFi", movie: 878, series: 10765 },
];

const ANIMATION_ID = 16; // same numeric id for both movie and TV genre lists
const MOVIE_ROMANCE_ID = 10749;
const MOVIE_COMEDY_ID = 35;
const MOVIE_DRAMA_ID = 18;
const MOVIE_FAMILY_ID = 10751;
const TV_DRAMA_ID = 18;
const TV_COMEDY_ID = 35;
const TV_SOAP_ID = 10766;
const TV_FAMILY_ID = 10751;
const TV_KIDS_ID = 10762;

/** List-level match (Discover rows/genre filter) — numeric TMDb genre ids + original_language, from MetaSearchResult. */
export function matchesAnimeByIds(genreIds: number[], originalLanguage: string | null | undefined): boolean {
  return genreIds.includes(ANIMATION_ID) && originalLanguage === "ja";
}

export function matchesTeenByIds(type: "movie" | "series", genreIds: number[]): boolean {
  const has = (id: number) => genreIds.includes(id);
  if (type === "movie") {
    if (has(MOVIE_FAMILY_ID)) return false;
    return has(MOVIE_ROMANCE_ID) && (has(MOVIE_COMEDY_ID) || has(MOVIE_DRAMA_ID));
  }
  if (has(TV_FAMILY_ID) || has(TV_KIDS_ID)) return false;
  return has(TV_SOAP_ID) || (has(TV_DRAMA_ID) && has(TV_COMEDY_ID));
}

/** Name-level match (library filter) — French genre-name strings, as stored on LibraryMovie/LibrarySeries.
 *  originCountry is never stored on library entries; isAnimeHint is the best-effort fallback (see
 *  LibraryMovie.isAnime/LibrarySeries.isAnime — real value once set, `genres.includes("Animation")`
 *  approximation until then, per the library-side design tradeoff). */
export function matchesAnimeByNames(genres: string[], isAnimeHint: boolean | undefined): boolean {
  if (isAnimeHint !== undefined) return isAnimeHint;
  return genres.includes("Animation");
}

export function matchesTeenByNames(type: "movie" | "series", genres: string[]): boolean {
  const has = (name: string) => genres.includes(name);
  if (type === "movie") {
    if (has("Familial")) return false;
    return has("Romance") && (has("Comédie") || has("Drame"));
  }
  if (has("Familial") || has("Kids")) return false;
  return has("Soap") || (has("Drame") && has("Comédie"));
}
