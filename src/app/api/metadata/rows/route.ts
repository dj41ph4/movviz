import { NextRequest, NextResponse } from "next/server";
import { trending, browseCategory, discoverByFilters, tmdbConfigured, getBoxOffice, getNewSeries, getKidsRow, getAnimeRow, getTeenRow } from "@/lib/metadata/tmdb";
import { GENRE_ROWS } from "@/lib/metadata/genreTaxonomy";
import { getAllocineNewVod } from "@/lib/metadata/allocineVod";
import { getAllocineTrendingSeries } from "@/lib/metadata/allocineSeries";
import { loadDiscoverLayout } from "@/lib/metadata/discoverStore";
import { requireUser } from "@/lib/auth/guard";
import { countriesForContinents } from "@/lib/metadata/continents";
import { getRecommendations } from "@/lib/recommender/engine";
import { loadMovies } from "@/lib/library/store";
import { loadRequests } from "@/lib/requests/store";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { User } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/**
 * Build an "upcoming" row that prioritizes the current user's own requested
 * movies (from the requests store, which IS per-user) whose library status is
 * "upcoming", and fills the rest with TMDb's editorial upcoming list — so
 * each user sees their own future releases first, then discovers other
 * unreleased movies.
 */
async function buildUpcomingRow(user: User | null, originCountries?: string[]): Promise<MetaSearchResult[]> {
  const [tmdbUpcoming, userMovies, requests] = await Promise.all([
    browseCategory("movie", "upcoming", 1, originCountries),
    loadMovies(),
    user ? loadRequests() : Promise.resolve([]),
  ]);

  const userTmdbSet = user
    ? new Set(requests.filter((r) => r.type === "movie" && r.userId === user.id).map((r) => r.tmdbId))
    : new Set<number>();

  const userUpcoming = userMovies
    .filter((m) => m.status === "upcoming" && (!user || user.role === "admin" || userTmdbSet.has(m.tmdbId)))
    .map((m) => ({
      tmdbId: m.tmdbId,
      type: "movie" as const,
      title: m.title,
      year: m.year,
      releaseDate: m.releaseDate,
      overview: m.overview,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      rating: m.rating,
    }));

  const extra = tmdbUpcoming.results.filter((r) => !userUpcoming.some((u) => u.tmdbId === r.tmdbId));

  return [...userUpcoming, ...extra];
}

/**
 * Curated homepage rows for Discover — several TMDb editorial buckets fetched
 * in parallel, so the discover home isn't a single flat list.
 *
 * Two row layouts, same TMDb-backed data either way:
 * - "movviz" (default): "recommendedTop" (suggestions ∪ best rated),
 *   "trendingPopular" (trending ∪ popular), upcoming/on-air.
 * - "allocine": mirrors the actual section ORDER on allocine.fr/film —
 *   "recommendedTop" first, then "nowPlayingBoxOffice" ("Films à l'affiche" +
 *   "Box office"), "upcomingVod" ("Prochainement" + "Nouveautés VOD"),
 *   "Tendances" ranked list, then "Kids". For series: "recommendedTop",
 *   "newSeriesRenewed" ("Nouvelles séries" + "Séries renouvelées"),
 *   "Tendances" ranked list.
 *
 * Sources are merged with dedupe (first source wins, by tmdbId) so the same
 * title never appears twice on the page.
 */
export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) {
    return NextResponse.json({ configured: false, rows: [] });
  }
  const type = req.nextUrl.searchParams.get("type") === "series" ? "series" : "movie";
  const layout = loadDiscoverLayout();
  const user = requireUser(req);
  const originCountries = countriesForContinents(user?.discoverContinents ?? []);

  const recommended = getRecommendations(user?.id ?? "", type);

  if (layout === "allocine") {
    if (type === "movie") {
      const [rec, newVod, nowPlaying, boxOffice, trend, topRated, upcomingResults, kids] = await Promise.all([
        recommended,
        getAllocineNewVod(),
        browseCategory("movie", "now_playing", 1, originCountries),
        getBoxOffice(1, originCountries),
        trending("movie", 1, originCountries),
        browseCategory("movie", "top_rated", 1, originCountries),
        buildUpcomingRow(user, originCountries),
        getKidsRow("movie", 1, originCountries),
      ]);
      const rows = [
        { key: "recommendedTop", results: dedupe([...rec, ...topRated.results]) },
        { key: "nowPlayingBoxOffice", results: dedupe([...nowPlaying.results, ...boxOffice.results]) },
        { key: "upcomingVod", results: dedupe([...upcomingResults, ...newVod.results]) },
        { key: "trending", results: trend.results.slice(0, 10), ranked: true },
        { key: "kids", results: kids.results },
      ].filter((r) => r.results.length > 0);
      return NextResponse.json({ configured: true, layout, rows });
    }

    const [rec, newSeries, renewed, trend, topRated] = await Promise.all([
      recommended,
      getNewSeries(1, originCountries),
      browseCategory("series", "on_the_air", 1, originCountries),
      getAllocineTrendingSeries(),
      browseCategory("series", "top_rated", 1, originCountries),
    ]);
    const rows = [
      { key: "recommendedTop", results: dedupe([...rec, ...topRated.results]) },
      { key: "newSeriesRenewed", results: dedupe([...newSeries.results, ...renewed.results]) },
      { key: "trending", results: trend.results.slice(0, 10), ranked: true },
    ].filter((r) => r.results.length > 0);
    return NextResponse.json({ configured: true, layout, rows });
  }

  const [rec, trend, popular, topRated, upcomingResults, acclaimed, animeRow, teenRow, shortFormat, ...genreResults] = await Promise.all([
    recommended,
    trending(type, 1, originCountries),
    browseCategory(type, "popular", 1, originCountries),
    browseCategory(type, "top_rated", 1, originCountries),
    type === "movie" ? buildUpcomingRow(user, originCountries) : browseCategory("series", "on_the_air", 1, originCountries).then((r) => r.results),
    discoverByFilters(type, { sort: "vote_average.desc", originCountries }, 1),
    getAnimeRow(type, 20, originCountries),
    getTeenRow(type, 20, originCountries),
    type === "movie" ? discoverByFilters("movie", { maxRuntime: 40, sort: "popularity.desc", originCountries }, 1) : Promise.resolve({ results: [], page: 1, totalPages: 1 }),
    ...GENRE_ROWS.map((g) => {
      const genreId = type === "movie" ? g.movie : g.series;
      return genreId === null
        ? Promise.resolve({ results: [], page: 1, totalPages: 1 })
        : discoverByFilters(type, { genre: String(genreId), sort: "popularity.desc", originCountries }, 1);
    }),
  ]);

  const rows = [
    { key: "recommendedTop", results: dedupe([...rec, ...topRated.results]) },
    { key: "trendingPopular", results: dedupe([...trend.results, ...popular.results]).slice(0, 10) },
    { key: type === "movie" ? "upcoming" : "onAir", results: upcomingResults },
    { key: "acclaimed", results: acclaimed.results },
    { key: "anime", results: animeRow.results },
    { key: "teen", results: teenRow.results },
    ...(type === "movie" ? [{ key: "shortFormat", results: shortFormat.results }] : []),
    ...GENRE_ROWS.map((g, i) => ({ key: g.key, results: genreResults[i].results })),
  ].filter((r) => r.results.length > 0);

  return NextResponse.json({ configured: true, layout, rows });
}

function dedupe(list: MetaSearchResult[]): MetaSearchResult[] {
  const seen = new Set<number>();
  const out: MetaSearchResult[] = [];
  for (const item of list) {
    if (seen.has(item.tmdbId)) continue;
    seen.add(item.tmdbId);
    out.push(item);
  }
  return out;
}
