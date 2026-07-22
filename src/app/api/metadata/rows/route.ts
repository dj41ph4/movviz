import { NextRequest, NextResponse } from "next/server";
import { trending, browseCategory, tmdbConfigured, getBoxOffice, getNewSeries, getKidsRow } from "@/lib/metadata/tmdb";
import { getAllocineNewVod } from "@/lib/metadata/allocineVod";
import { getAllocineTrendingSeries } from "@/lib/metadata/allocineSeries";
import { loadDiscoverLayout } from "@/lib/metadata/discoverStore";
import { requireUser } from "@/lib/auth/guard";
import { countriesForContinents } from "@/lib/metadata/continents";
import { getRecommendations } from "@/lib/recommender/engine";

export const dynamic = "force-dynamic";

/**
 * Curated homepage rows for Discover — several TMDb editorial buckets fetched
 * in parallel, so the discover home isn't a single flat list.
 *
 * Two row layouts, same TMDb-backed data either way:
 * - "movviz" (default): trending/popular/top-rated/upcoming.
 * - "allocine": mirrors the actual section ORDER on allocine.fr/film — cinema
 *   content first ("Films à l'affiche" → "Prochainement" → "Tendances"
 *   ranked list → "Meilleurs films"), VOD/streaming further down ("Nouveautés
 *   VOD"), then the less prominent "Box office" and "Kids" sections that sit
 *   near the bottom of their homepage. For series: "Nouvelles séries" /
 *   "Séries renouvelées" / "Tops séries" / "Meilleures séries". ("Toutes les
 *   séries"/"Toutes les films" isn't a content row on their site either —
 *   it's the "see everything" link, which is what search/filters already do
 *   here.)
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
      const [rec, newVod, nowPlaying, boxOffice, trend, topRated, upcoming, kids] = await Promise.all([
        recommended,
        getAllocineNewVod(),
        browseCategory("movie", "now_playing", 1, originCountries),
        getBoxOffice(1, originCountries),
        trending("movie", 1, originCountries),
        browseCategory("movie", "top_rated", 1, originCountries),
        browseCategory("movie", "upcoming", 1, originCountries),
        getKidsRow("movie", 1, originCountries),
      ]);
      const rows = [
        { key: "recommended", results: rec },
        { key: "nowPlaying", results: nowPlaying.results },
        { key: "upcoming", results: upcoming.results },
        { key: "trending", results: trend.results.slice(0, 10), ranked: true },
        { key: "topRated", results: topRated.results },
        { key: "newVod", results: newVod.results },
        { key: "boxOffice", results: boxOffice.results },
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
      { key: "recommended", results: rec },
      { key: "newSeries", results: newSeries.results },
      { key: "renewed", results: renewed.results },
      { key: "trending", results: trend.results.slice(0, 10), ranked: true },
      { key: "topRated", results: topRated.results },
    ].filter((r) => r.results.length > 0);
    return NextResponse.json({ configured: true, layout, rows });
  }

  const lastCategory = type === "movie" ? "upcoming" : "on_the_air";
  const [rec, trend, popular, topRated, last] = await Promise.all([
    recommended,
    trending(type, 1, originCountries),
    browseCategory(type, "popular", 1, originCountries),
    browseCategory(type, "top_rated", 1, originCountries),
    browseCategory(type, lastCategory, 1, originCountries),
  ]);

  const rows = [
    { key: "recommended", results: rec },
    { key: "trending", results: trend.results },
    { key: "popular", results: popular.results },
    { key: "topRated", results: topRated.results },
    { key: type === "movie" ? "upcoming" : "onAir", results: last.results },
  ].filter((r) => r.results.length > 0);

  return NextResponse.json({ configured: true, layout, rows });
}
