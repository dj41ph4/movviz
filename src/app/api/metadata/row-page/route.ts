import { NextRequest, NextResponse } from "next/server";
import { trending, browseCategory, getBoxOffice, getNewSeries, getKidsRow, tmdbConfigured } from "@/lib/metadata/tmdb";
import { getAllocineNewVod } from "@/lib/metadata/allocineVod";
import { requireUser } from "@/lib/auth/guard";
import { countriesForContinents } from "@/lib/metadata/continents";
import { getRecommendations } from "@/lib/recommender/engine";
import type { MetaSearchResult } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;
const REC_CACHE_TTL = 10 * 60 * 1000;

function getRecCache(): Map<string, { data: MetaSearchResult[]; ts: number }> {
  return (globalThis as any).__movvizRecCache ??= new Map();
}

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
        const cache = getRecCache();
        const cacheKey = `${user?.id ?? ""}:${type}`;
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          all = await getRecommendations(user?.id ?? "", type);
          cache.set(cacheKey, { data: all, ts: Date.now() });
        }
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
      default: return null;
    }
  })();

  if (!result) return NextResponse.json({ error: "unknown row" }, { status: 400 });
  return NextResponse.json({ results: result.results, page: result.page, totalPages: result.totalPages });
}
