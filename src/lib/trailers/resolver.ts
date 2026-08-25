import { getCache } from "@/lib/cache/registry";
import { resolveAppleTrailer } from "./providers/apple";
import { resolveImdbTrailer } from "./providers/imdb";
import type { TrailerSource } from "./types";

// 24h — long enough to spare Apple/IMDb a request on every page view, short
// enough that a provider coming back online (IMDb) or a title's trailer
// changing shows up within a day, matching the plan's 24h-7d window without
// needing a second, longer-lived negative-result cache.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = getCache("trailerResolver", TTL_MS);

/**
 * Apple → IMDb → [] (existing YouTube fields are the caller's own fallback,
 * untouched by this module). Never throws — a provider failure degrades to
 * "no enhanced source", not a broken page.
 */
export async function resolveTrailerSources(
  type: "movie" | "series",
  tmdbId: number,
  title: string,
  year: number | null,
  imdbId: string | null
): Promise<TrailerSource[]> {
  const key = `${type}:${tmdbId}`;
  const cached = cache.get<TrailerSource[]>(key);
  if (cached) return cached;

  const sources: TrailerSource[] = [];
  try {
    const apple = await resolveAppleTrailer(type, title, year);
    if (apple) sources.push(apple);
  } catch {
    // best-effort — falls through to IMDb/YouTube
  }
  try {
    const imdb = await resolveImdbTrailer(type, imdbId);
    if (imdb) sources.push(imdb);
  } catch {
    // best-effort — falls through to YouTube
  }

  cache.set(key, sources);
  return sources;
}
