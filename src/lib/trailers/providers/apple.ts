import { titleSimilarity } from "@/lib/library/matching";
import type { TrailerSource } from "../types";

/**
 * Apple's classic iTunes Search API is used here — NOT the tv.apple.com
 * catalog originally planned. Live investigation during implementation
 * found: `media=movie`/`entity=movie` filters always return 0 results
 * (confirmed on multiple well-known titles — Apple appears to have broken/
 * retired that filter combo), and tv.apple.com's public search page only
 * renders a generic "related content" shelf in its static HTML, not real
 * query results (those load via an authenticated JS-only endpoint we can't
 * reach). The unfiltered iTunes Search API still works, and each
 * `feature-movie` result carries a `previewUrl` — a real, unauthenticated,
 * directly-fetchable MP4 (confirmed live: 18MB video/x-m4v, HTTP 200, no
 * auth). That IS the trailer/preview clip, with no tv.apple.com scraping or
 * umc.cmc id lookup needed at all.
 */

const FETCH_TIMEOUT_MS = 4000;

interface ITunesResult {
  kind?: string;
  trackName?: string;
  trackCensoredName?: string;
  previewUrl?: string;
  releaseDate?: string;
  country?: string;
}

// A wrong-movie trailer is worse than none — this only fires for a close
// title match AND an agreeing (or absent) release year.
const MIN_TITLE_SIMILARITY = 0.82;

function parseDimensions(url: string): { width?: number; height?: number } {
  // previewUrl filenames embed their own resolution, e.g.
  // "...mzvf_....640x478.h264lc.U.p.m4v" — confirmed live on real responses.
  const m = url.match(/\.(\d{2,4})x(\d{2,4})\./);
  if (!m) return {};
  return { width: Number(m[1]), height: Number(m[2]) };
}

export async function resolveAppleTrailer(
  type: "movie" | "series",
  title: string,
  year: number | null,
  region: string = "US"
): Promise<TrailerSource | null> {
  // Verified live only for movies — iTunes' "feature-movie" kind has no
  // clean series/episode equivalent, so series always fall through to the
  // next provider (IMDb) or the existing YouTube chain untouched.
  if (type !== "movie") return null;

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&country=${encodeURIComponent(region)}&limit=10`;
  let results: ITunesResult[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    results = Array.isArray(data?.results) ? data.results : [];
  } catch {
    return null;
  }

  const candidates = results.filter((r) => r.kind === "feature-movie" && r.previewUrl);
  if (candidates.length === 0) return null;

  let best: ITunesResult | null = null;
  let bestScore = 0;
  for (const r of candidates) {
    const name = r.trackCensoredName || r.trackName;
    if (!name) continue;
    const score = titleSimilarity(title, name);
    const resultYear = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : null;
    const yearAgrees = year == null || resultYear == null || Math.abs(resultYear - year) <= 1;
    if (!yearAgrees) continue;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  if (!best || !best.previewUrl || bestScore < MIN_TITLE_SIMILARITY) return null;

  const dims = parseDimensions(best.previewUrl);
  return {
    provider: "apple",
    playbackType: "mp4",
    url: best.previewUrl,
    type: "trailer",
    language: null,
    ...dims,
  };
}
