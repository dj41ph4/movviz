import { titleSimilarity } from "@/lib/library/matching";
import { getCache } from "@/lib/cache/registry";
import { searchTv, type PagedResults } from "./tmdb";
import type { MetaSearchResult } from "./types";

/**
 * "Séries les plus consultées cette semaine" row for the allocine Discover
 * layout — the real ranking from allocine.fr's series homepage, rather than
 * TMDb's generic worldwide trending signal. AlloCiné exposes no API, so this
 * scrapes the page directly — best-effort, and it WILL break if the site
 * changes its markup. Each scraped title is matched back to TMDb so the row
 * plugs into the same card/detail/add-to-library flow as every other row;
 * the scraped order is preserved, entries that can't be matched are dropped.
 */

const SOURCE_URL = "https://www.allocine.fr/series/";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — the ranking shifts through the day but not by the minute
const MATCH_THRESHOLD = 0.6;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function scrapeTitles(): Promise<string[]> {
  try {
    const res = await fetch(SOURCE_URL, { headers: { "user-agent": "Mozilla/5.0 (compatible; Movviz)" } });
    if (!res.ok) return [];
    const html = await res.text();

    const titles: string[] = [];
    const seen = new Set<string>();
    for (const m of html.matchAll(/href="\/series\/ficheserie_gen_cserie=\d+\.html" title="([^"]+)"/g)) {
      const title = decodeHtmlEntities(m[1]).trim();
      if (title && !seen.has(title)) {
        seen.add(title);
        titles.push(title);
      }
    }
    return titles;
  } catch {
    return [];
  }
}

async function matchTitle(title: string): Promise<MetaSearchResult | null> {
  const { results } = await searchTv(title);
  let best: MetaSearchResult | null = null;
  let bestScore = 0;
  for (const cand of results.slice(0, 8)) {
    const score = titleSimilarity(title, cand.title);
    if (score >= MATCH_THRESHOLD && score > bestScore) {
      best = cand;
      bestScore = score;
    }
  }
  return best;
}

export async function getAllocineTrendingSeries(): Promise<PagedResults> {
  const cache = getCache("AlloCiné trending series (allocine.fr)", CACHE_TTL_MS);
  const cacheKey = `${SOURCE_URL}#trending`;
  const cached = cache.get<PagedResults>(cacheKey);
  if (cached !== undefined) return cached;

  const titles = await scrapeTitles();
  const matched = await Promise.all(titles.map(matchTitle));
  const seen = new Set<number>();
  const results: MetaSearchResult[] = [];
  for (const m of matched) {
    if (m && !seen.has(m.tmdbId)) {
      seen.add(m.tmdbId);
      results.push(m);
    }
  }

  const paged: PagedResults = { results, page: 1, totalPages: 1 };
  // A failed scrape isn't worth remembering for 6 hours.
  if (results.length > 0) cache.set(cacheKey, paged);
  return paged;
}
