import { getCache } from "@/lib/cache/registry";
import { resolveAppleTrailer } from "./providers/apple";
import { resolveImdbTrailer } from "./providers/imdb";
import { resolveNetflixTrailer } from "./providers/netflix";
import { resolveDisneyPlusTrailer } from "./providers/disneyPlus";
import { resolvePrimeVideoTrailer } from "./providers/primeVideo";
import type { TrailerSource } from "./types";

// 24h — long enough to spare Apple/IMDb a request on every page view, short
// enough that a provider coming back online (IMDb) or a title's trailer
// changing shows up within a day, matching the plan's 24h-7d window without
// needing a second, longer-lived negative-result cache.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = getCache("trailerResolver", TTL_MS);

/**
 * Apple → IMDb → Netflix → Disney+ → Prime Video → [] (existing YouTube
 * fields are the caller's own fallback, untouched by this module). Never
 * throws — a provider failure degrades to "no enhanced source", not a
 * broken page.
 *
 * Netflix/Disney+/Prime Video are wired into the chain (same order, same
 * cache, same toggle) per movviz-extension-netflix-disney-prime-concis.md,
 * but each currently always resolves to null — investigated live before
 * writing them (see each provider's own doc comment): the only real,
 * working technique for Netflix/Prime requires session cookies, negotiating
 * a DRM-capable stream, and server-side FFmpeg remuxing of separate audio/
 * video tracks, which fails both this project's "no new FFmpeg
 * transcoding" rule and the plan's own "no cookies/DRM" rule. Disney+ has
 * no known public technique at all. Kept as real slots (not deleted) in
 * case a genuinely public, DRM-free method surfaces later — exactly the
 * same reasoning as imdb.ts.
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
    // best-effort — falls through to the next provider
  }
  try {
    const imdb = await resolveImdbTrailer(type, imdbId);
    if (imdb) sources.push(imdb);
  } catch {
    // best-effort — falls through to the next provider
  }
  try {
    const netflix = await resolveNetflixTrailer(type, title, year);
    if (netflix) sources.push(netflix);
  } catch {
    // best-effort — falls through to the next provider
  }
  try {
    const disneyPlus = await resolveDisneyPlusTrailer(type, title, year);
    if (disneyPlus) sources.push(disneyPlus);
  } catch {
    // best-effort — falls through to the next provider
  }
  try {
    const primeVideo = await resolvePrimeVideoTrailer(type, title, year);
    if (primeVideo) sources.push(primeVideo);
  } catch {
    // best-effort — falls through to YouTube
  }

  cache.set(key, sources);
  return sources;
}
