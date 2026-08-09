import { NextRequest, NextResponse } from "next/server";
import { trending, browseCategory, getBoxOffice, getNewSeries, getKidsRow, tmdbConfigured } from "@/lib/metadata/tmdb";
import { getAllocineNewVod } from "@/lib/metadata/allocineVod";
import { getC411RowPage } from "@/lib/c411/catalog";
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
      case "c411Popular":
      case "c411Recent":
      case "c411Today": {
        const all = (await getC411RowPage(key, 1, PER_PAGE * 10)).filter((r) => r.type === type);
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
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
      case "recommendedTop": {
        const cache = getRecCache();
        const cacheKey = `recommendedTop:${user?.id ?? ""}:${type}`;
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          const [rec, top1, top2] = await Promise.all([
            getRecommendations(user?.id ?? "", type),
            browseCategory(type, "top_rated", 1, originCountries),
            browseCategory(type, "top_rated", 2, originCountries),
          ]);
          all = dedupe([...rec, ...top1.results, ...top2.results]);
          cache.set(cacheKey, { data: all, ts: Date.now() });
        }
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
      case "trendingPopular": {
        const cache = getRecCache();
        const cacheKey = `trendingPopular:${type}`;
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          const [t1, t2, p1, p2] = await Promise.all([
            trending(type, 1, originCountries),
            trending(type, 2, originCountries),
            browseCategory(type, "popular", 1, originCountries),
            browseCategory(type, "popular", 2, originCountries),
          ]);
          all = dedupe([...t1.results, ...t2.results, ...p1.results, ...p2.results]);
          cache.set(cacheKey, { data: all, ts: Date.now() });
        }
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
      case "nowPlayingBoxOffice": {
        const cache = getRecCache();
        const cacheKey = "nowPlayingBoxOffice";
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          const [np1, np2, b1, b2] = await Promise.all([
            browseCategory("movie", "now_playing", 1, originCountries),
            browseCategory("movie", "now_playing", 2, originCountries),
            getBoxOffice(1, originCountries),
            getBoxOffice(2, originCountries),
          ]);
          all = dedupe([...np1.results, ...np2.results, ...b1.results, ...b2.results]);
          cache.set(cacheKey, { data: all, ts: Date.now() });
        }
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
      case "upcomingVod": {
        const cache = getRecCache();
        const cacheKey = "upcomingVod";
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          const [u1, u2, v1, v2] = await Promise.all([
            browseCategory("movie", "upcoming", 1, originCountries),
            browseCategory("movie", "upcoming", 2, originCountries),
            getAllocineNewVod(1),
            getAllocineNewVod(2),
          ]);
          all = dedupe([...u1.results, ...u2.results, ...v1.results, ...v2.results]);
          cache.set(cacheKey, { data: all, ts: Date.now() });
        }
        const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const results = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        return { results, page, totalPages };
      }
      case "newSeriesRenewed": {
        const cache = getRecCache();
        const cacheKey = "newSeriesRenewed";
        const cached = cache.get(cacheKey);
        let all: MetaSearchResult[];
        if (cached && Date.now() - cached.ts < REC_CACHE_TTL) {
          all = cached.data;
        } else {
          const [n1, n2, r1, r2] = await Promise.all([
            getNewSeries(1, originCountries),
            getNewSeries(2, originCountries),
            browseCategory("series", "on_the_air", 1, originCountries),
            browseCategory("series", "on_the_air", 2, originCountries),
          ]);
          all = dedupe([...n1.results, ...n2.results, ...r1.results, ...r2.results]);
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
