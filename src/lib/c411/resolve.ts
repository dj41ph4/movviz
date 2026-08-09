import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { getMovie, getSeries, searchMulti, searchMovies, searchTv } from "@/lib/metadata/tmdb";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { mapWithConcurrency } from "@/lib/concurrency";

/**
 * Resolves C411 release names / bare tmdbIds to full TMDb-backed
 * MetaSearchResults so the Discover tab can render them as normal cards.
 *
 * C411's /api/torrents and /api/torrents/today payloads carry no tmdbId, so
 * their French-style release names must be normalized and searched on TMDb.
 * Every resolution is cached to disk (30-day TTL) — the first fetch of a day
 * burns some searches, repeat visits cost nothing.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const CACHE_FILE = path.join(CONFIG_DIR, "c411-tmdb-cache.json");

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface ResolveCacheEntry {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  year: number | null;
  posterPath: string | null;
  rating: number;
  ts: number;
}

type ResolveCache = Record<string, ResolveCacheEntry>;

function loadCache(): ResolveCache {
  return readJsonCached<ResolveCache>(CACHE_FILE, {});
}

function cacheGet(cache: ResolveCache, key: string): ResolveCacheEntry | null {
  const e = cache[key];
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) return null;
  return e;
}

function cacheSet(cache: ResolveCache, key: string, entry: ResolveCacheEntry) {
  cache[key] = entry;
  writeJsonCached(CACHE_FILE, cache);
}

const TAG_WORDS = [
  "MULTI", "VFF", "VFI", "VF2", "VFQ", "VOSTFR", "VOST", "SUBFRENCH", "SUBFORCED",
  "TRUEFRENCH", "TRUE-FRENCH", "FRENCH", "10BIT", "HEVC", "H265", "H264", "X265",
  "X264", "AVC", "BLURAY", "BRRIP", "BDRIP", "WEBRIP", "WEB-DL", "WEB", "HDR10PLUS",
  "HDR10", "HDR", "SDR", "DOLBYVISION", "VISION", "ATMOS", "TRUEHD", "DTS-HD", "DTS",
  "AC3", "EAC3", "AAC", "FLAC", "720P", "1080P", "2160P", "4K", "UHD", "REMUX",
  "REPACK", "PROPER", "EXTENDED", "UNRATED", "IMAX", "AMZN", "DSNP", "HMAX", "ATVP",
  "TF1P", "CANALPLUS", "CANAL", "COMPLETE", "INTEGRALE", "INT\u00C9GRALE", "PACK",
  "EPISODE", "AV1", "NOTAG",
];
const TAG_RE = new RegExp(`\\b(?:${TAG_WORDS.join("|")})\\b`, "gi");
const EP_RE = /\bS\d{1,2}E\d{1,3}\b/gi;
const SEASON_RE = /\bS\d{1,2}\b/gi;
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;

/**
 * Release groups are glued to the last tag with a hyphen (x264-EXCELLENCE,
 * EAC3.5.1-Floppy) — drop them so the group never pollutes the search title.
 * Only fires when the token right before the hyphen is a codec/tag, so
 * genuine hyphenated titles survive.
 */
const GROUP_ANCHOR_RE =
  /(x264|x265|xvid|h264|h265|hevc|avc|eac3(?:\.\d+)?|ac3|dts|aac|flac|truehd|atmos|webrip|bluray|bdrip|brrip|remux|720p|1080p|2160p|10bit|repack|proper|multi|vff|vfi|vfq|vf2|vostfr|french)$/i;

function stripReleaseGroup(name: string): string {
  const idx = name.lastIndexOf("-");
  if (idx <= 0) return name;
  const group = name.slice(idx + 1);
  if (!/^[A-Za-z0-9]+$/.test(group)) return name;
  const prev = name.slice(0, idx);
  if (!GROUP_ANCHOR_RE.test(prev)) return name;
  return prev;
}

export interface ParsedReleaseName {
  /** Searchable title (tags/season markers/separators removed). */
  clean: string;
  year: number | null;
  kind: "series" | "movie" | "unknown";
}

export function parseReleaseName(name: string): ParsedReleaseName {
  // Underscores are word chars — \b tags like VFQ won't match after one.
  // AD (audio description) is only stripped when uppercase so "Ad Astra"
  // survives; 10.bits normalizes to the 10BIT tag; "5.1"-style audio channel
  // markers are dropped so they never pollute the search title.
  let s = name
    .replace(/_/g, ".")
    .replace(/\bAD\b/g, " ")
    .replace(/10\.bits?/gi, "10BIT")
    .replace(/\b\d+\.\d+\b/g, " ")
    .replace(EP_RE, " ")
    .replace(SEASON_RE, " ")
    .replace(YEAR_RE, " ");
  const year = name.match(YEAR_RE) ? Number(name.match(YEAR_RE)![1]) : null;
  s = stripReleaseGroup(s);
  s = s.replace(TAG_RE, " ").replace(/[._\-\[\](){}]/g, " ").replace(/\s+/g, " ").trim();
  const seriesHint =
    /\bS\d{1,2}E\d{1,3}\b/i.test(name) ||
    /\b(PACK|COMPLETE|INTEGRALE|INT\u00C9GRALE)\b/i.test(name);
  const movieHint = year !== null;
  return {
    clean: s.toLowerCase(),
    year,
    kind: seriesHint ? "series" : movieHint ? "movie" : "unknown",
  };
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüçœæ]/g, "").trim();
}

function pickBest(
  results: MetaSearchResult[],
  clean: string,
  year: number | null,
  kind: "series" | "movie" | "unknown"
): MetaSearchResult | null {
  if (results.length === 0) return null;
  const wanted = normTitle(clean);
  let best: { r: MetaSearchResult; score: number } | null = null;
  for (const r of results) {
    let score = 0;
    if (normTitle(r.title) === wanted) score += 2;
    if (year !== null && r.year === year) score += 1;
    if (kind === "series" && r.type === "series") score += 1;
    if (kind === "movie" && r.type === "movie") score += 1;
    if (!best || score > best.score) best = { r, score };
  }
  // Require real signal (exact title, or year + matching type) — a random
  // cross-match must never land on the Discover rows.
  if (!best || best.score < 2) return null;
  return best.r;
}

/** Resolve one C411 release name to a TMDb-backed result (disk-cached). */
export async function resolveRelease(name: string): Promise<MetaSearchResult | null> {
  const parsed = parseReleaseName(name);
  if (!parsed.clean) return null;
  const cache = loadCache();
  const key = `n:${parsed.kind}:${parsed.clean}:${parsed.year ?? ""}`;
  const cached = cacheGet(cache, key);
  if (cached) return cached.tmdbId === 0 ? null : entryToResult(cached);

  let picked: MetaSearchResult | null = null;
  if (parsed.kind === "series") {
    const page = await searchTv(parsed.clean, 1);
    picked = pickBest(page.results, parsed.clean, parsed.year, "series");
  } else if (parsed.kind === "movie") {
    const page = await searchMovies(parsed.clean, 1);
    picked = pickBest(page.results, parsed.clean, parsed.year, "movie");
  } else {
    const page = await searchMulti(parsed.clean, 1);
    picked = pickBest(page.results, parsed.clean, parsed.year, "unknown");
  }

  if (!picked) {
    // Remember misses too so we don't re-search the same title every visit.
    cacheSet(cache, key, { tmdbId: 0, type: "movie", title: "", year: null, posterPath: null, rating: 0, ts: Date.now() });
    return null;
  }
  cacheSet(cache, key, resultToEntry(picked));
  return picked;
}

/** Resolve a batch of release names with bounded concurrency (TMDb free tier). */
export async function resolveReleases(names: string[]): Promise<MetaSearchResult[]> {
  const out = await mapWithConcurrency(names, 5, async (n) => resolveRelease(n));
  return out.filter((r): r is MetaSearchResult => r !== null);
}

/** Classify a bare tmdbId as movie or series — one TMDb detail call, disk-cached. */
export async function classifyTmdbId(tmdbId: number): Promise<"movie" | "series" | null> {
  if (!tmdbId || tmdbId <= 0) return null;
  const cache = loadCache();
  const key = `id:${tmdbId}`;
  const cached = cacheGet(cache, key);
  if (cached) return cached.tmdbId === 0 ? null : cached.type;
  const movie = await getMovie(tmdbId);
  if (movie) {
    cacheSet(cache, key, resultToEntry({ tmdbId, type: "movie", title: movie.title, year: movie.year, releaseDate: movie.releaseDate, overview: "", posterPath: movie.posterPath, backdropPath: null, rating: movie.rating }));
    return "movie";
  }
  const series = await getSeries(tmdbId);
  if (series) {
    cacheSet(cache, key, resultToEntry({ tmdbId, type: "series", title: series.title, year: series.year, releaseDate: series.releaseDate, overview: "", posterPath: series.posterPath, backdropPath: null, rating: series.rating }));
    return "series";
  }
  cacheSet(cache, key, { tmdbId: 0, type: "movie", title: "", year: null, posterPath: null, rating: 0, ts: Date.now() });
  return null;
}

function resultToEntry(r: MetaSearchResult): ResolveCacheEntry {
  return { tmdbId: r.tmdbId, type: r.type, title: r.title, year: r.year, posterPath: r.posterPath, rating: r.rating, ts: Date.now() };
}

function entryToResult(e: ResolveCacheEntry): MetaSearchResult {
  return {
    tmdbId: e.tmdbId,
    type: e.type,
    title: e.title,
    year: e.year,
    releaseDate: null,
    overview: "",
    posterPath: e.posterPath,
    backdropPath: null,
    rating: e.rating,
  };
}

/** Convert a full TMDb image URL (as C411 hands them out) to Movviz's relative posterPath. */
export function posterPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/t\/p\/\w+\/(.+)$/);
  return m ? `/${m[1]}` : null;
}
