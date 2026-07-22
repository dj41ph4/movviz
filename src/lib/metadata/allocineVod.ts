import { titleSimilarity } from "@/lib/library/matching";
import { getCache } from "@/lib/cache/registry";
import { searchMovies, type PagedResults, type MovieSearchHit } from "./tmdb";
import type { MetaSearchResult } from "./types";

/**
 * "Nouvelles sorties" row for the allocine Discover layout — the actual
 * films currently landing on French VOD storefronts, in the exact order
 * allocine.fr lists them on its "Derniers films en VOD" page. TMDb has no
 * equivalent signal (its digital release dates are worldwide and wildly
 * incomplete for France), and AlloCiné exposes no API, so this scrapes the
 * page directly — best-effort, and it WILL break if the site changes its
 * markup. Each scraped title is then matched back to TMDb so the row plugs
 * into the same card/detail/add-to-library flow as every other row; the
 * scraped order is preserved, entries that can't be matched are dropped.
 */

const SOURCE_BASE = "https://www.allocine.fr/vod/films/new/";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — the source updates a few times a week
const MATCH_THRESHOLD = 0.6;

interface VodEntry {
  title: string;
  originalTitle: string | null;
}

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

async function scrapePage(page: number): Promise<{ entries: VodEntry[]; totalPages: number }> {
  try {
    const url = page > 1 ? `${SOURCE_BASE}?page=${page}` : SOURCE_BASE;
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; Movviz)" } });
    if (!res.ok) return { entries: [], totalPages: 0 };
    const html = await res.text();

    // Each film card starts with its title link; splitting there keeps the
    // card's metadata (incl. the original title) inside the same chunk.
    const chunks = html.split(/class="meta-title-link"/).slice(1);
    const entries: VodEntry[] = [];
    for (const chunk of chunks) {
      const rawTitle = chunk.match(/^[^>]*>([^<]+)</)?.[1];
      if (!rawTitle) continue;
      // Titles on this page carry a trailing "VOD" badge inside the link text.
      const title = decodeHtmlEntities(rawTitle).replace(/\s*VOD\s*$/, "").trim();
      if (!title) continue;
      const rawOriginal = chunk.match(/Titre original\s*<\/span>\s*<span class="dark-grey">([^<]+)</)?.[1];
      const originalTitle = rawOriginal ? decodeHtmlEntities(rawOriginal).trim() || null : null;
      entries.push({ title, originalTitle });
    }

    let totalPages = 1;
    for (const m of html.matchAll(/\/vod\/films\/new\/\?page=(\d+)/g)) {
      totalPages = Math.max(totalPages, Number(m[1]));
    }
    return { entries, totalPages };
  } catch {
    return { entries: [], totalPages: 0 };
  }
}

function scoreCandidate(entry: VodEntry, cand: MovieSearchHit): number {
  let score = Math.max(titleSimilarity(entry.title, cand.title), titleSimilarity(entry.title, cand.originalTitle));
  if (entry.originalTitle) {
    score = Math.max(
      score,
      titleSimilarity(entry.originalTitle, cand.title),
      titleSimilarity(entry.originalTitle, cand.originalTitle)
    );
  }
  // The page only lists brand-new releases: when a title has homonyms
  // (remakes, same-name older films), the recent candidate is the right one.
  if (score > 0 && cand.year && cand.year >= new Date().getFullYear() - 2) score += 0.05;
  return score;
}

/**
 * Best-effort TMDb match. Tries both the original-title and French-title
 * queries and keeps the single best-scoring candidate across both — TMDb's
 * search recall varies a lot by query, so a query that returns *a* match
 * above the threshold isn't necessarily the one holding the *right* match.
 */
async function matchEntry(entry: VodEntry): Promise<MetaSearchResult | null> {
  const queries =
    entry.originalTitle && entry.originalTitle !== entry.title
      ? [entry.originalTitle, entry.title]
      : [entry.title];

  let best: MovieSearchHit | null = null;
  let bestScore = 0;
  for (const query of queries) {
    const { results } = await searchMovies(query);
    for (const cand of results.slice(0, 8)) {
      const score = scoreCandidate(entry, cand);
      if (score >= MATCH_THRESHOLD && score > bestScore) {
        best = cand;
        bestScore = score;
      }
    }
  }
  return best;
}

export async function getAllocineNewVod(page = 1): Promise<PagedResults> {
  const cache = getCache("AlloCiné VOD releases (allocine.fr)", CACHE_TTL_MS);
  const cacheKey = `${SOURCE_BASE}#p${page}`;
  const cached = cache.get<PagedResults>(cacheKey);
  if (cached !== undefined) return cached;

  const { entries, totalPages } = await scrapePage(page);
  const matched = await Promise.all(entries.map(matchEntry));
  const seen = new Set<number>();
  const results: MetaSearchResult[] = [];
  for (const m of matched) {
    if (m && !seen.has(m.tmdbId)) {
      seen.add(m.tmdbId);
      results.push(m);
    }
  }

  const paged: PagedResults = { results, page, totalPages };
  // A failed scrape isn't worth remembering for 6 hours.
  if (results.length > 0) cache.set(cacheKey, paged);
  return paged;
}
