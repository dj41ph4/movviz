import type {
  MetaMovie,
  MetaSeries,
  MetaSeason,
  MetaSearchResult,
  MetaDetail,
  MetaWatchProvider,
  MetaCollectionDetail,
} from "./types";
import path from "node:path";
import { loadTmdbKey } from "./store";
import { getCache } from "@/lib/cache/registry";
import { omdbConfigured, getOmdbRatings } from "./omdb";

const TMDB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — enough to dedupe repeated calls without going stale
const TMDB_CACHE_NAME = "The Movie Database API";
const TMDB_CACHE_FILE = path.join(
  process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"),
  "tmdb-cache.json"
);

function tmdbCache() {
  return getCache(TMDB_CACHE_NAME, TMDB_CACHE_TTL_MS, TMDB_CACHE_FILE);
}

/**
 * TMDb client — the source of truth for "what movies/series exist". Requires
 * a free API key from themoviedb.org (Settings → API). Read from
 * MOVVIZ_TMDB_API_KEY, with a fallback to a locally persisted key (set from
 * Settings so the user isn't forced to touch environment variables).
 */

const BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

/** Ships with a working key so Movviz discovers content out of the box — Settings lets anyone swap in their own. */
const DEFAULT_TMDB_API_KEY = "0216fd47717b17e80ba94a3bb1c82d2e";

function apiKey(): string | null {
  return process.env.MOVVIZ_TMDB_API_KEY ?? loadTmdbKey() ?? DEFAULT_TMDB_API_KEY;
}

export function tmdbConfigured(): boolean {
  return !!apiKey();
}

export function tmdbImageUrl(path: string | null, size: "w342" | "w500" | "original" = "w500") {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

// URLs currently being refreshed in the background, so a burst of requests on
// the same stale entry triggers exactly one upstream fetch. Anchored on
// globalThis because Next.js bundles this module once per route.
const gRefresh = globalThis as typeof globalThis & { __movvizTmdbRefreshing?: Set<string> };
const refreshing: Set<string> = (gRefresh.__movvizTmdbRefreshing ??= new Set());

async function fetchAndCache<T>(url: string): Promise<T | null> {
  const cache = tmdbCache();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.log("[tmdb] fetchAndCache — " + url.replace(/\?api_key=[^&]+/, "?api_key=***") + " status=" + res.status);
      return null;
    }
    const data = (await res.json()) as T;
    cache.set(url, data);
    return data;
  } catch (e) {
    console.log("[tmdb] fetchAndCache — error fetching " + url.replace(/\?api_key=[^&]+/, "?api_key=***") + " " + e);
    return null;
  }
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}, language?: string): Promise<T | null> {
  const key = apiKey();
  if (!key) {
    console.log("[tmdb] tmdbGet — no API key configured, path=" + path);
    return null;
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", language ?? "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cache = tmdbCache();
  const cacheKey = url.toString();
  const cached = cache.getStale<T>(cacheKey);
  if (cached !== undefined) {
    // Past the TTL: serve the stale copy instantly and refresh behind the
    // scenes — the response the user is waiting on never blocks on TMDb.
    if (!cached.fresh && !refreshing.has(cacheKey)) {
      refreshing.add(cacheKey);
      fetchAndCache<T>(cacheKey).finally(() => refreshing.delete(cacheKey));
    }
    return cached.value;
  }

  return fetchAndCache<T>(cacheKey);
}

function yearOf(date: string | undefined | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export interface PagedResults {
  results: MetaSearchResult[];
  page: number;
  totalPages: number;
}

/**
 * Junk ratings: an unrated title (0/10) or a "10/10" resting on a single
 * vote both read as noise, not a real signal. Upcoming titles and titles
 * released in the last month are exempt from the 0/10 check — they simply
 * haven't accumulated votes yet, that's not the same as being junk.
 */
function isJunkRating(r: RawMultiResult): boolean {
  const rating = r.vote_average ?? 0;
  const voteCount = r.vote_count ?? 0;
  if (rating === 10 && voteCount <= 1) return true;
  if (voteCount === 0) return true;
  if (rating !== 0) return false;
  const releaseDate = r.release_date ?? r.first_air_date;
  if (!releaseDate) return true;
  const daysSinceRelease = (Date.now() - new Date(releaseDate).getTime()) / 86400000;
  return daysSinceRelease > 30;
}

function mapPaged(
  data: { results: RawMultiResult[]; page?: number; total_pages?: number } | null,
  type?: "movie" | "series"
): PagedResults {
  if (!data) return { results: [], page: 1, totalPages: 0 };
  return {
    results: data.results
      .filter((r) => !type || r.media_type === undefined || r.media_type === (type === "movie" ? "movie" : "tv"))
      .filter((r) => !isJunkRating(r))
      .map((r) => ({
        tmdbId: r.id,
        type: type ?? (r.media_type === "movie" ? "movie" : "series"),
        title: r.title ?? r.name ?? "",
        year: yearOf(r.release_date ?? r.first_air_date),
        releaseDate: (r.release_date ?? r.first_air_date)?.slice(0, 10) ?? null,
        overview: r.overview ?? "",
        posterPath: r.poster_path ?? null,
        rating: r.vote_average ?? 0,
      })),
    page: data.page ?? 1,
    // TMDb caps pagination at 500 pages regardless of reported total.
    totalPages: Math.min(data.total_pages ?? 1, 500),
  };
}

/** Combined movie + TV search, normalized to one result shape. */
export async function searchMulti(query: string, page = 1): Promise<PagedResults> {
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>("/search/multi", {
    query,
    page: String(page),
  });
  if (!data) return { results: [], page: 1, totalPages: 0 };
  const filtered = { ...data, results: data.results.filter((r) => r.media_type === "movie" || r.media_type === "tv") };
  return mapPaged(filtered);
}

/**
 * Movie-only search that keeps the original title alongside the localized
 * one — needed when matching titles scraped from a French source, where the
 * same film may be listed under either name.
 */
export interface MovieSearchHit extends MetaSearchResult {
  originalTitle: string;
}

export async function searchTv(query: string, page = 1): Promise<PagedResults> {
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>("/search/tv", {
    query,
    page: String(page),
  });
  return mapPaged(data, "series");
}

export async function searchMovies(query: string, page = 1): Promise<{ results: MovieSearchHit[] }> {
  const data = await tmdbGet<{ results: RawMultiResult[] }>("/search/movie", {
    query,
    page: String(page),
  });
  return {
    results: (data?.results ?? []).map((r) => ({
      tmdbId: r.id,
      type: "movie" as const,
      title: r.title ?? "",
      year: yearOf(r.release_date),
      releaseDate: r.release_date?.slice(0, 10) ?? null,
      overview: r.overview ?? "",
      posterPath: r.poster_path ?? null,
      rating: r.vote_average ?? 0,
      originalTitle: r.original_title ?? r.title ?? "",
    })),
  };
}

/**
 * TMDb's fixed lists (/trending, /movie/popular, etc.) don't accept an
 * origin-country filter — extra query params are silently ignored. When a
 * user has picked continents in their Discover preferences, every row is
 * rebuilt from /discover instead, with parameters chosen to approximate the
 * same editorial bucket (e.g. "top rated" becomes sort by rating with a
 * minimum vote count instead of TMDb's own curated chart).
 */
function discoverParamsFor(
  type: "movie" | "series",
  bucket: "trending" | BrowseCategory,
  originCountries?: string[]
): Record<string, string> {
  const params: Record<string, string> = {};
  if (originCountries && originCountries.length > 0) params.with_origin_country = originCountries.join("|");
  const today = new Date().toISOString().slice(0, 10);
  switch (bucket) {
    case "trending":
    case "popular":
      params.sort_by = "popularity.desc";
      break;
    case "top_rated":
      params.sort_by = "vote_average.desc";
      params["vote_count.gte"] = "200";
      break;
    case "upcoming":
      params.sort_by = "primary_release_date.asc";
      params["primary_release_date.gte"] = today;
      params["vote_count.gte"] = "10";
      break;
    case "now_playing": {
      const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
      params.sort_by = "popularity.desc";
      params["primary_release_date.gte"] = since;
      params["primary_release_date.lte"] = today;
      break;
    }
    case "on_the_air": {
      const until = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
      params.sort_by = "popularity.desc";
      params["air_date.gte"] = today;
      params["air_date.lte"] = until;
      break;
    }
    case "airing_today":
      params.sort_by = "popularity.desc";
      params["air_date.gte"] = today;
      params["air_date.lte"] = today;
      break;
  }
  return params;
}

export async function trending(
  type: "movie" | "series" = "movie",
  page = 1,
  originCountries?: string[]
): Promise<PagedResults> {
  const kind = type === "movie" ? "movie" : "tv";
  if (originCountries && originCountries.length > 0) {
    const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
      `/discover/${kind}`,
      { ...discoverParamsFor(type, "trending", originCountries), page: String(page) }
    );
    return mapPaged(data, type);
  }
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    `/trending/${kind}/week`,
    { page: String(page) }
  );
  return mapPaged(data, type);
}

/** Curated browse lists beyond trending — Popular/Top rated/Upcoming/On air, TMDb's own editorial buckets. */
export type BrowseCategory = "popular" | "top_rated" | "upcoming" | "now_playing" | "on_the_air" | "airing_today";

export async function browseCategory(
  type: "movie" | "series",
  category: BrowseCategory,
  page = 1,
  originCountries?: string[]
): Promise<PagedResults> {
  const kind = type === "movie" ? "movie" : "tv";
  if (originCountries && originCountries.length > 0) {
    const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
      `/discover/${kind}`,
      { ...discoverParamsFor(type, category, originCountries), page: String(page) }
    );
    return mapPaged(data, type);
  }
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    `/${kind}/${category}`,
    { page: String(page) }
  );
  return mapPaged(data, type);
}

/** TMDB recommendations for a single movie — `/movie/{id}/recommendations`. */
export async function getMovieRecommendations(tmdbId: number): Promise<PagedResults> {
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    `/movie/${tmdbId}/recommendations`
  );
  return mapPaged(data, "movie");
}

/** TMDB recommendations for a single series — `/tv/{id}/recommendations`. */
export async function getTvRecommendations(tmdbId: number): Promise<PagedResults> {
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    `/tv/${tmdbId}/recommendations`
  );
  return mapPaged(data, "series");
}

/** Current box-office leaders — real recent releases ranked by revenue, not TMDb's all-time chart. */
export async function getBoxOffice(page = 1, originCountries?: string[]): Promise<PagedResults> {
  const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const params: Record<string, string> = {
    sort_by: "revenue.desc",
    "primary_release_date.gte": since,
    "vote_count.gte": "20",
    page: String(page),
  };
  if (originCountries && originCountries.length > 0) params.with_origin_country = originCountries.join("|");
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    "/discover/movie",
    params
  );
  return mapPaged(data, "movie");
}

/** Series that just started airing — TMDb has no dedicated "new" bucket, so this is discover sorted by first air date. */
export async function getNewSeries(page = 1, originCountries?: string[]): Promise<PagedResults> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const params: Record<string, string> = {
    sort_by: "first_air_date.desc",
    "first_air_date.gte": since,
    "vote_count.gte": "5",
    page: String(page),
  };
  if (originCountries && originCountries.length > 0) params.with_origin_country = originCountries.join("|");
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    "/discover/tv",
    params
  );
  return mapPaged(data, "series");
}

const KIDS_GENRE_ID = { movie: "10751", series: "10762" }; // Family (movies) / Kids (TV) — TMDb's own genre ids

/** Family/Kids row — same discover endpoint as the filter UI, just pinned to the Kids genre. */
export async function getKidsRow(type: "movie" | "series", page = 1, originCountries?: string[]): Promise<PagedResults> {
  return discoverByFilters(type, { genre: KIDS_GENRE_ID[type], sort: "popularity.desc", originCountries }, page);
}

export async function getMovie(tmdbId: number): Promise<MetaMovie | null> {
  const data = await tmdbGet<RawMovie>(`/movie/${tmdbId}`, { append_to_response: "external_ids,release_dates" });
  if (!data) return null;
  return {
    tmdbId: data.id,
    imdbId: data.external_ids?.imdb_id ?? data.imdb_id ?? null,
    title: data.title,
    year: yearOf(data.release_date),
    overview: data.overview ?? "",
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    rating: data.vote_average ?? 0,
    runtime: data.runtime ?? null,
    genres: (data.genres ?? []).map((g) => g.name),
    releaseDate: data.release_date ?? null,
    vfReleaseDate: extractFrDigitalOrPhysicalDate(data.release_dates?.results),
    collectionId: data.belongs_to_collection?.id ?? null,
  };
}

export async function getSeries(tmdbId: number): Promise<MetaSeries | null> {
  const data = await tmdbGet<RawSeries>(`/tv/${tmdbId}`, { append_to_response: "external_ids" });
  if (!data) return null;
  return {
    tmdbId: data.id,
    imdbId: data.external_ids?.imdb_id ?? null,
    tvdbId: data.external_ids?.tvdb_id != null ? Number(data.external_ids.tvdb_id) : null,
    title: data.name,
    year: yearOf(data.first_air_date),
    releaseDate: data.first_air_date?.slice(0, 10) ?? null,
    overview: data.overview ?? "",
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    rating: data.vote_average ?? 0,
    genres: (data.genres ?? []).map((g) => g.name),
    status: data.status ?? "",
    isAnime: !!data.origin_country?.includes("JP") && !!data.genres?.some((g) => g.name === "Animation"),
    seasons: (data.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        airDate: s.air_date ?? null,
        posterPath: s.poster_path ?? null,
        episodes: [],
      })),
  };
}

export async function getSeason(tmdbId: number, seasonNumber: number): Promise<MetaSeason | null> {
  const data = await tmdbGet<RawSeasonDetail>(`/tv/${tmdbId}/season/${seasonNumber}`);
  if (!data) return null;
  return {
    seasonNumber: data.season_number,
    name: data.name,
    episodeCount: data.episodes?.length ?? 0,
    airDate: data.air_date ?? null,
    posterPath: data.poster_path ?? null,
    episodes: (data.episodes ?? []).map((e) => ({
      seasonNumber: e.season_number,
      episodeNumber: e.episode_number,
      title: e.name,
      airDate: e.air_date ?? null,
      overview: e.overview ?? "",
      stillPath: e.still_path ?? null,
    })),
  };
}

export interface MetaGenre {
  id: number;
  name: string;
}

export async function getGenres(type: "movie" | "series"): Promise<MetaGenre[]> {
  const kind = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet<{ genres: MetaGenre[] }>(`/genre/${kind}/list`);
  return data?.genres ?? [];
}

export interface DiscoverFilters {
  genre?: string;
  year?: string;
  sort?: string; // TMDb sort_by value, e.g. "popularity.desc"
  company?: string; // with_companies — studio filter (movies)
  network?: string; // with_networks — broadcaster filter (series only)
  originCountries?: string[]; // with_origin_country — user's Discover continent preference
}

const DATE_FIELD: Record<"movie" | "series", string> = { movie: "primary_release_date", series: "first_air_date" };

/** Filtered browse — genre/year/rating sort/studio/network, beyond plain trending. */
export async function discoverByFilters(
  type: "movie" | "series",
  filters: DiscoverFilters,
  page = 1
): Promise<PagedResults> {
  const kind = type === "movie" ? "movie" : "tv";
  const dateField = DATE_FIELD[type];
  let sortBy = filters.sort || "popularity.desc";
  // The UI only ever sends the movie-flavored "primary_release_date.*" sort
  // key — TMDb's TV endpoint only recognizes "first_air_date.*" and silently
  // ignores anything else, falling back to its own default order.
  if (sortBy.startsWith("primary_release_date.") && type === "series") {
    sortBy = sortBy.replace("primary_release_date.", "first_air_date.");
  }
  const params: Record<string, string> = { sort_by: sortBy, page: String(page) };
  if (filters.genre) params.with_genres = filters.genre;
  if (filters.year) params[type === "movie" ? "primary_release_year" : "first_air_date_year"] = filters.year;
  if (filters.company) params.with_companies = filters.company;
  if (filters.network && type === "series") params.with_networks = filters.network;
  if (filters.originCountries && filters.originCountries.length > 0) {
    params.with_origin_country = filters.originCountries.join("|");
  }
  // Sorting by rating alone surfaces obscure titles with a single 10/10 vote;
  // TMDb's own "top rated" needs a minimum sample size to mean anything.
  if (sortBy === "vote_average.desc") params["vote_count.gte"] = "200";
  // Sorting by date alone surfaces far-future placeholder entries (unreleased
  // titles registered years or decades ahead) — cap at today for "newest".
  if (sortBy === `${dateField}.desc`) params[`${dateField}.lte`] = new Date().toISOString().slice(0, 10);
  const data = await tmdbGet<{ results: RawMultiResult[]; page: number; total_pages: number }>(
    `/discover/${kind}`,
    params
  );
  return mapPaged(data, type);
}

export interface MetaPerson {
  id: number;
  name: string;
  profilePath: string | null;
  biography: string;
  credits: MetaSearchResult[]; // combined movie + TV filmography, sorted by popularity
}

/**
 * Fetch the translated title of a movie or series in a specific language.
 * Falls back to the original title if the locale returns an empty/unknown title.
 */
export async function getTitleInLanguage(tmdbId: number, type: "movie" | "series", language: string): Promise<string | null> {
  const data = await tmdbGet<{ title?: string; name?: string; original_title?: string; original_name?: string }>(
    type === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`,
    {},
    language
  );
  return data?.title ?? data?.name ?? data?.original_title ?? data?.original_name ?? null;
}

/** A person's profile + full filmography — powers "see everything with this actor". */
export async function getPerson(personId: number): Promise<MetaPerson | null> {
  const [person, credits] = await Promise.all([
    tmdbGet<{ id: number; name: string; profile_path: string | null; biography?: string }>(`/person/${personId}`),
    tmdbGet<{ cast: RawMultiResult[] }>(`/person/${personId}/combined_credits`),
  ]);
  if (!person) return null;
  const seen = new Set<number>();
  const filmography = (credits?.cast ?? [])
    .filter((c) => c.media_type === "movie" || c.media_type === "tv")
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .map((c) => ({
      tmdbId: c.id,
      type: (c.media_type === "movie" ? "movie" : "series") as "movie" | "series",
      title: c.title ?? c.name ?? "",
      year: yearOf(c.release_date ?? c.first_air_date),
      releaseDate: (c.release_date ?? c.first_air_date)?.slice(0, 10) ?? null,
      overview: c.overview ?? "",
      posterPath: c.poster_path ?? null,
      rating: c.vote_average ?? 0,
    }));
  return {
    id: person.id,
    name: person.name,
    profilePath: person.profile_path ?? null,
    biography: person.biography ?? "",
    credits: filmography,
  };
}

/** Logo art for a studio (company) or broadcaster (network) tile — best-effort, null if TMDb has none. */
export async function getCompanyLogo(id: number): Promise<string | null> {
  const data = await tmdbGet<{ logo_path?: string | null }>(`/company/${id}`);
  return data?.logo_path ?? null;
}

export async function getNetworkLogo(id: number): Promise<string | null> {
  const data = await tmdbGet<{ logo_path?: string | null }>(`/network/${id}`);
  return data?.logo_path ?? null;
}

/** Overview + cast + similar titles + franchise collection, for a detail page. */
const KEY_CREW_JOBS = new Set(["Director", "Writer", "Screenplay", "Producer", "Editor", "Creator"]);

export async function getDetail(type: "movie" | "series", tmdbId: number): Promise<MetaDetail | null> {
  const kind = type === "movie" ? "movie" : "tv";
  const [data, watchProviders] = await Promise.all([
    tmdbGet<RawDetail>(`/${kind}/${tmdbId}`, {
      append_to_response: "credits,recommendations,keywords,external_ids,videos",
    }),
    getWatchProviders(type, tmdbId),
  ]);
  if (!data) return null;
  const imdbId = data.external_ids?.imdb_id ?? null;
  const omdb = imdbId && omdbConfigured() ? await getOmdbRatings(imdbId) : null;
  const keywords = type === "movie" ? data.keywords?.keywords : data.keywords?.results;
  return {
    tmdbId: data.id,
    type,
    title: data.title ?? data.name ?? "",
    originalTitle: data.original_title ?? data.original_name ?? data.title ?? data.name ?? "",
    year: yearOf(data.release_date ?? data.first_air_date),
    overview: data.overview ?? "",
    tagline: data.tagline ?? "",
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    rating: data.vote_average ?? 0,
    genres: (data.genres ?? []).map((g) => g.name),
    runtime: data.runtime ?? data.episode_run_time?.[0] ?? null,
    status: data.status ?? "",
    originalLanguage: data.original_language ?? "",
    countries: (data.production_countries ?? []).map((c) => c.name),
    studios: (data.production_companies ?? []).map((c) => c.name),
    keywords: (keywords ?? []).map((k) => k.name),
    cast: (data.credits?.cast ?? []).slice(0, 24).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ?? null,
    })),
    crew: (data.credits?.crew ?? [])
      .filter((c) => KEY_CREW_JOBS.has(c.job))
      .slice(0, 24)
      .map((c) => ({ id: c.id, name: c.name, job: c.job })),
    isAnime: type === "series" && !!data.origin_country?.includes("JP") && !!data.genres?.some((g) => g.name === "Animation"),
    tvdbId: data.external_ids?.tvdb_id != null ? Number(data.external_ids.tvdb_id) : null,
    imdbId,
    watchProviders,
    releaseDateFull: data.release_date ?? data.first_air_date ?? null,
    revenue: type === "movie" && data.revenue ? data.revenue : null,
    budget: type === "movie" && data.budget ? data.budget : null,
    trailerKey: pickTrailer(data.videos?.results),
    rtScore: omdb?.rtScore ?? null,
    metascore: omdb?.metascore ?? null,
    imdbRating: omdb?.imdbRating ?? null,
    similar: (data.recommendations?.results ?? []).slice(0, 12).map((r) => ({
      tmdbId: r.id,
      type,
      title: r.title ?? r.name ?? "",
      year: yearOf(r.release_date ?? r.first_air_date),
      releaseDate: (r.release_date ?? r.first_air_date)?.slice(0, 10) ?? null,
      overview: r.overview ?? "",
      posterPath: r.poster_path ?? null,
      rating: r.vote_average ?? 0,
    })),
    collection: data.belongs_to_collection
      ? { id: data.belongs_to_collection.id, name: data.belongs_to_collection.name, posterPath: data.belongs_to_collection.poster_path ?? null }
      : null,
    seasons: type === "series" ? (data.seasons ?? []).map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date,
    })) : undefined,
  };
}

interface RawSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

interface RawDetail {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: { id: number; name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  status?: string;
  original_language?: string;
  revenue?: number;
  budget?: number;
  production_countries?: { name: string }[];
  production_companies?: { name: string }[];
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  belongs_to_collection?: { id: number; name: string; poster_path: string | null } | null;
  seasons?: RawSeasonSummary[];
  credits?: {
    cast?: { id: number; name: string; character: string; profile_path: string | null }[];
    crew?: { id: number; name: string; job: string }[];
  };
  recommendations?: { results?: RawMultiResult[] };
  external_ids?: { imdb_id?: string | null; tvdb_id?: number | string | null };
  origin_country?: string[];
  videos?: { results?: RawVideo[] };
}

interface RawVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

/** Best available YouTube trailer: an official "Trailer" first, then any Trailer, then any YouTube video at all. */
function pickTrailer(videos: RawVideo[] | undefined): string | null {
  const yt = (videos ?? []).filter((v) => v.site === "YouTube");
  const officialTrailer = yt.find((v) => v.type === "Trailer" && v.official);
  if (officialTrailer) return officialTrailer.key;
  const anyTrailer = yt.find((v) => v.type === "Trailer");
  if (anyTrailer) return anyTrailer.key;
  return yt[0]?.key ?? null;
}

interface RawWatchProviders {
  results?: Record<string, { flatrate?: RawProvider[]; ads?: RawProvider[]; free?: RawProvider[] }>;
}
interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

/**
 * "Where to watch" for a title — TMDb's data is region-specific and doesn't
 * distinguish rent/buy from actually-included-in-a-subscription, so this only
 * surfaces subscription-style access (flatrate/ads/free), which is what
 * "available on" badges usually mean. Tries France first, falls back to the
 * US since TMDb's provider coverage is much better there.
 */
export async function getWatchProviders(type: "movie" | "series", tmdbId: number): Promise<MetaWatchProvider[]> {
  const kind = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet<RawWatchProviders>(`/${kind}/${tmdbId}/watch/providers`);
  const region = data?.results?.FR?.flatrate?.length || data?.results?.FR?.ads?.length || data?.results?.FR?.free?.length
    ? data.results.FR
    : data?.results?.US;
  if (!region) return [];
  const providers = [...(region.flatrate ?? []), ...(region.ads ?? []), ...(region.free ?? [])];
  const seen = new Set<number>();
  return providers
    .filter((p) => (seen.has(p.provider_id) ? false : (seen.add(p.provider_id), true)))
    .map((p) => ({ providerId: p.provider_id, name: p.provider_name, logoPath: p.logo_path ?? null }));
}

interface RawCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: RawMultiResult[];
}

/** A movie franchise ("Saga") — every entry TMDb groups under the same collection id. */
export async function getCollection(collectionId: number): Promise<MetaCollectionDetail | null> {
  const data = await tmdbGet<RawCollection>(`/collection/${collectionId}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    overview: data.overview ?? "",
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    parts: (data.parts ?? [])
      .map((r) => ({
        tmdbId: r.id,
        type: "movie" as const,
        title: r.title ?? r.name ?? "",
        year: yearOf(r.release_date),
        releaseDate: r.release_date?.slice(0, 10) ?? null,
        overview: r.overview ?? "",
        posterPath: r.poster_path ?? null,
        rating: r.vote_average ?? 0,
      }))
      .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999")),
  };
}

// --- Raw TMDb response shapes (subset actually used) ---

interface RawMultiResult {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

interface RawMovie {
  id: number;
  imdb_id?: string | null;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  runtime?: number | null;
  genres?: { id: number; name: string }[];
  external_ids?: { imdb_id?: string | null };
  release_dates?: { results?: RawReleaseDatesCountry[] };
  belongs_to_collection?: { id: number; name: string; poster_path: string | null } | null;
}

interface RawReleaseDatesCountry {
  iso_3166_1: string;
  release_dates: { release_date: string; type: number }[];
}

/**
 * France's digital/physical release date — the moment a title actually
 * becomes obtainable, as opposed to the theatrical date. TMDb release types:
 * 1 Premiere, 2 Theatrical (limited), 3 Theatrical, 4 Digital, 5 Physical, 6 TV.
 */
function extractFrDigitalOrPhysicalDate(results: RawReleaseDatesCountry[] | undefined): string | null {
  const fr = results?.find((r) => r.iso_3166_1 === "FR");
  if (!fr) return null;
  const dates = fr.release_dates.filter((d) => d.type === 4 || d.type === 5).map((d) => d.release_date.slice(0, 10));
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

interface RawSeries {
  id: number;
  name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: { id: number; name: string }[];
  origin_country?: string[];
  status?: string;
  seasons?: {
    season_number: number;
    name: string;
    episode_count: number;
    air_date?: string | null;
    poster_path?: string | null;
  }[];
  external_ids?: { imdb_id?: string | null; tvdb_id?: number | string | null };
}

interface RawSeasonDetail {
  season_number: number;
  name: string;
  air_date?: string | null;
  poster_path?: string | null;
  episodes?: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date?: string | null;
    overview?: string;
    still_path?: string | null;
  }[];
}
