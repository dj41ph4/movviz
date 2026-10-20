import { getCache } from "@/lib/cache/registry";
import { searchYouTubeTrailers } from "@/lib/media/youtubeSearch";
import { blockedVideoKeys, isBlockedVideo } from "./blockedVideos";

/**
 * Replacement trailers for a title whose every TMDb video is blocked from
 * embedded playback. Results are cached 24h per title/language; known-blocked
 * keys are filtered at read time so a newly reported block applies at once.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const cacheKey = (title: string, year: number | null, language: string) => `ytfb:v1:${title}:${year ?? 0}:${language}`;
const cache = () => getCache("YouTube Fallback", TTL_MS);
const g = globalThis as typeof globalThis & { __movvizTrailerFallbackInflight?: Map<string, Promise<string[]>> };
const inflight = (g.__movvizTrailerFallbackInflight ??= new Map<string, Promise<string[]>>());

export async function fallbackTrailerKeys(title: string, year: number | null, language: string): Promise<string[]> {
  const key = cacheKey(title, year, language);
  const cached = cache().getStale<string[]>(key);
  if (cached !== undefined) return cached.value.filter((k) => !isBlockedVideo(k));
  let pending = inflight.get(key);
  if (!pending) {
    pending = searchYouTubeTrailers(title, year, language, { exclude: blockedVideoKeys() })
      .then((keys) => { cache().set(key, keys); return keys; })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return (await pending).filter((k) => !isBlockedVideo(k));
}

/** Cache-only read for request paths that must not wait on a YouTube page
 *  fetch: returns what is known now and warms the cache in the background. */
export function cachedFallbackTrailerKeys(title: string, year: number | null, language: string): string[] {
  const cached = cache().getStale<string[]>(cacheKey(title, year, language));
  if (cached !== undefined) return cached.value.filter((k) => !isBlockedVideo(k));
  void fallbackTrailerKeys(title, year, language).catch(() => []);
  return [];
}
