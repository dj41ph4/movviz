import { NextRequest, NextResponse } from "next/server";
import { trending, browseCategory, getBoxOffice, getNewSeries, getKidsRow, tmdbConfigured } from "@/lib/metadata/tmdb";
import { getAllocineNewVod } from "@/lib/metadata/allocineVod";
import { requireUser } from "@/lib/auth/guard";
import { countriesForContinents } from "@/lib/metadata/continents";
import { getRecommendations } from "@/lib/recommender/engine";

export const dynamic = "force-dynamic";

/**
 * Paginated "see all" for a single Discover home row — every row on the
 * homepage (trending/box office/kids/...) is backed by one of these same
 * functions with page 1 hardcoded; this just re-runs the same query at
 * whatever page the "Voir tout" grid has scrolled to.
 */
export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const type = req.nextUrl.searchParams.get("type") === "series" ? "series" : "movie";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const user = requireUser(req);
  const originCountries = countriesForContinents(user?.discoverContinents ?? []);

  const result = await (async () => {
    switch (key) {
      case "trending": return trending(type, page, originCountries);
      case "popular": return browseCategory(type, "popular", page, originCountries);
      case "topRated": return browseCategory(type, "top_rated", page, originCountries);
      case "upcoming": return browseCategory("movie", "upcoming", page, originCountries);
      case "onAir": return browseCategory("series", "on_the_air", page, originCountries);
      case "nowPlaying": return browseCategory("movie", "now_playing", page, originCountries);
      case "boxOffice": return getBoxOffice(page, originCountries);
      case "kids": return getKidsRow(type, page, originCountries);
      case "newSeries": return getNewSeries(page, originCountries);
      case "newVod": return getAllocineNewVod(page);
      case "renewed": return browseCategory("series", "on_the_air", page, originCountries);
      case "recommended": {
        // Not backed by TMDb pagination — it's a scored aggregate, so the
        // whole list is already page 1; later pages are simply empty.
        if (page > 1) return { results: [], page, totalPages: 1 };
        const results = await getRecommendations(user?.id ?? "", type);
        return { results, page: 1, totalPages: 1 };
      }
      default: return null;
    }
  })();

  if (!result) return NextResponse.json({ error: "unknown row" }, { status: 400 });
  return NextResponse.json({ results: result.results, page: result.page, totalPages: result.totalPages });
}
