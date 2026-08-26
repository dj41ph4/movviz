/**
 * Movviz metadata layer — TMDb-backed. This is what lets the app know movies
 * and series actually exist (title, year, IDs, artwork, season/episode
 * structure) instead of matching on free text alone.
 */

export interface MetaMovie {
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  runtime: number | null;
  genres: string[];
  releaseDate: string | null; // ISO date, exact — year alone isn't enough for a calendar
  vfReleaseDate: string | null; // France digital/physical release date — when the title is actually obtainable
  collectionId: number | null; // TMDb franchise id (belongs_to_collection) — null if this movie isn't part of one
  originalTitle: string; // TMDb's non-localized title — what a scene release is actually named after
  isAnime: boolean; // original_language "ja" + genre Animation — movies have no origin_country at the detail level (TV-only in TMDb's schema), unlike MetaSeries.isAnime below
}

export interface MetaEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null; // ISO date
  overview: string;
  stillPath: string | null;
}

export interface MetaSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
  episodes: MetaEpisode[];
}

export interface MetaSeries {
  tmdbId: number;
  imdbId: string | null;
  tvdbId: number | null;
  title: string;
  year: number | null;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  genres: string[];
  status: string; // "Returning Series", "Ended", ...
  isAnime: boolean; // Japanese origin + Animation genre — triggers TVDB episode metadata when enabled
  seasons: MetaSeason[]; // summary only (no episodes) when listed from search
  originalTitle: string; // TMDb's non-localized title — what a scene release is actually named after
}

export interface MetaSearchResult {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  year: number | null;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  /** Raw TMDb genre ids (list-level field, never resolved to names here) — feeds genreTaxonomy.ts's list-friendly matchers (Anime/Teen) without a second per-title fetch. Optional: only populated by mapPaged() (trending/browseCategory/discoverByFilters); other MetaSearchResult producers (recommendations, similar titles...) predate this field and don't set it — absent means "no signal", never treated as a match. */
  genreIds?: number[];
  /** ISO 639-1, e.g. "ja" — list-level field TMDb provides on every search/discover/trending item, unlike origin_country which is TV-only. Same optionality as genreIds. */
  originalLanguage?: string | null;
  /** Raw TMDb vote count — same optionality/provenance as genreIds (only
   *  mapPaged() sets it). Used to weight a tie-break by statistical
   *  significance, never rating alone: a handful of votes can produce a
   *  misleadingly high average (see resolveAiItemOnce's tie-break). */
  voteCount?: number;
}

export interface MetaPersonSearchResult {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  /** TMDb's own classification ("Acting", "Directing", "Writing", ...) —
   *  the search result's best signal for an actor/réalisateur badge without
   *  an expensive per-person credits fetch. */
  knownForDepartment: string | null;
  popularity: number;
}

export interface MetaCastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface MetaCrewMember {
  id: number;
  name: string;
  job: string; // Director, Writer, Producer, Editor...
}

export interface MetaCollection {
  id: number;
  name: string;
  posterPath: string | null;
}

export interface MetaCollectionDetail {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  parts: MetaSearchResult[];
}

export interface MetaWatchProvider {
  providerId: number;
  name: string;
  logoPath: string | null;
}

export interface MetaSeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
}

export interface MetaDetail {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  tagline: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  genres: string[];
  runtime: number | null; // minutes — movie runtime, or a series' typical episode length
  status: string; // "Released", "Returning Series", "Ended"...
  originalLanguage: string; // ISO 639-1, e.g. "en"
  countries: string[]; // ISO 3166-1 production countries
  studios: string[];
  keywords: string[];
  cast: MetaCastMember[];
  crew: MetaCrewMember[];
  similar: MetaSearchResult[];
  collection: MetaCollection | null;
  seasons?: MetaSeasonSummary[]; // series only — populated from TMDb
  isAnime: boolean; // series only — Japanese origin + Animation genre
  tvdbId: number | null; // series only
  imdbId: string | null;
  watchProviders: MetaWatchProvider[];
  releaseDateFull: string | null;
  vfReleaseDate: string | null; // exact ISO date, when known — release/first-air date
  revenue: number | null; // movies only, TMDb doesn't report this for series
  budget: number | null; // movies only
  trailerKey: string | null; // YouTube video id, or null if none found — first (best) entry of trailerKeys
  trailerKeys: string[]; // "Details" context (Trailer > Teaser) — the fiche's explicit "watch trailer" action. Ordered fallback candidates — a video can be geo/embed-blocked per-viewer in ways TMDb's own metadata never flags, so the player tries the next one instead of just failing.
  ambientVideoKeys: string[]; // "Carousel" context (Teaser > Trailer) — every autoplay/ambient background (dashboard hero, fiche header). Same ordered-fallback contract as trailerKeys. See selectMediaVideo() in tmdb.ts.
  rtScore: number | null; // Rotten Tomatoes critics score (0-100) — only set when an OMDb key is configured
  metascore: number | null; // Metacritic (0-100) — same
  imdbRating: number | null; // real IMDb score (0-10, distinct from TMDb's own community score) — same
}
