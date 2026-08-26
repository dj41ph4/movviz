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
 * cache, same toggle) per movviz-extension-netflix-disney-prime-concis.md.
 * Prime Video is real and live-verified: its public GetPlaybackResources
 * API needs no auth, and a downloaded segment from its DASH manifest was
 * confirmed unencrypted (no DRM markers anywhere in the manifest) — see
 * providers/primeVideo.ts. Netflix was re-investigated live after an
 * initial (too pessimistic) rejection — the anonymous-cookie technique
 * itself checks out, but Netflix's own manifest API rejected the request
 * outright with `RESTRICTED_TO_TESTERS`, a real account-level gate, not a
 * DRM/stream issue — so it stays null. Disney+ has no known public
 * technique at all. Both are kept as real slots (not deleted) in case
 * Netflix's restriction changes or a Disney+ method surfaces later — same
 * reasoning as imdb.ts.
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
  // A provider throwing (network error, timeout, rate-limit — see apple.ts)
  // is a TRANSIENT failure, never the same thing as "this title genuinely
  // has no trailer." Confirmed live: a burst of resolve calls tripped
  // Apple's rate-limiting on this server's IP, and caching that empty
  // result for the full 24h TTL would have hidden Dune: Part Two's real,
  // working trailer for a day. When any provider throws, the result for
  // this title is served but NOT cached, so the very next request retries
  // fresh instead of being stuck behind a false negative.
  let hadTransientFailure = false;
  try {
    const apple = await resolveAppleTrailer(type, title, year);
    if (apple) sources.push(apple);
  } catch {
    hadTransientFailure = true;
  }
  try {
    const imdb = await resolveImdbTrailer(type, imdbId);
    if (imdb) sources.push(imdb);
  } catch {
    hadTransientFailure = true;
  }
  try {
    const netflix = await resolveNetflixTrailer(type, title, year);
    if (netflix) sources.push(netflix);
  } catch {
    hadTransientFailure = true;
  }
  try {
    const disneyPlus = await resolveDisneyPlusTrailer(type, title, year);
    if (disneyPlus) sources.push(disneyPlus);
  } catch {
    hadTransientFailure = true;
  }
  try {
    const primeVideo = await resolvePrimeVideoTrailer(type, title, year);
    if (primeVideo) sources.push(primeVideo);
  } catch {
    hadTransientFailure = true;
  }

  if (!hadTransientFailure) cache.set(key, sources);
  return sources;
}
