import path from "node:path";
import { loadOmdbConfig } from "./omdbStore";
import { getCache } from "@/lib/cache/registry";

const OMDB_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // ratings barely move day to day — spare the free-tier daily quota
const OMDB_CACHE_FILE = path.join(
  process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"),
  "omdb-cache.json"
);

function omdbCache() {
  return getCache("OMDb API", OMDB_CACHE_TTL_MS, OMDB_CACHE_FILE);
}

export function omdbConfigured(): boolean {
  return !!loadOmdbConfig().apiKey;
}

export interface OmdbRatings {
  rtScore: number | null; // Rotten Tomatoes critics score, 0-100
  metascore: number | null; // Metacritic, 0-100
  imdbRating: number | null; // real IMDb score, 0-10 (distinct from TMDb's own community score)
}

interface RawOmdbResponse {
  Response: "True" | "False";
  imdbRating?: string;
  Ratings?: { Source: string; Value: string }[];
}

/**
 * Third-party ratings TMDb doesn't provide (Rotten Tomatoes, Metacritic, the
 * real IMDb score) — opt-in, needs the user's own OMDb API key (Settings >
 * Métadonnées). Returns null with zero network calls when not configured, so
 * the UI can simply not render these badges at all rather than show broken
 * ones.
 */
export async function getOmdbRatings(imdbId: string): Promise<OmdbRatings | null> {
  const cfg = loadOmdbConfig();
  if (!cfg.apiKey) return null;

  const cache = omdbCache();
  const cacheKey = imdbId;
  const cached = cache.getStale<OmdbRatings | null>(cacheKey);
  if (cached !== undefined) return cached.value;

  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(cfg.apiKey)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RawOmdbResponse;
    if (data.Response !== "True") return null;

    const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
    const mc = data.Ratings?.find((r) => r.Source === "Metacritic")?.Value;
    const result: OmdbRatings = {
      rtScore: rt ? parseInt(rt, 10) : null,
      metascore: mc ? parseInt(mc, 10) : null,
      imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null,
    };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Validates a key against a known title — used by the Settings "Tester" button. */
export async function testOmdbKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=tt0111161&apikey=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.Response === "True";
  } catch {
    return false;
  }
}
