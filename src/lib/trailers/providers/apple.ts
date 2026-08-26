import { titleSimilarity } from "@/lib/library/matching";
import type { TrailerSource } from "../types";

/**
 * Apple's classic iTunes Search API is used to FIND the title (`media=movie`/
 * `entity=movie` filters always return 0 results — Apple appears to have
 * broken/retired that filter combo — the unfiltered search works). Its
 * `previewUrl` field is a real, directly-fetchable MP4, but only ~640px
 * wide (confirmed live) — nowhere near 1080p.
 *
 * The actual high-quality source: each result's `trackViewUrl`
 * (itunes.apple.com/us/movie/...) 301-redirects straight to the matching
 * tv.apple.com/{region}/movie/{slug}/{umc.cmc.id} page — solving, via the
 * search API itself, the "which umc.cmc id is this title" lookup problem
 * that blocked a direct tv.apple.com implementation earlier. That page
 * embeds several `"hlsUrl":"..."` values in its HTML; the one whose `a=`
 * query param matches this result's own trackId (and whose path is
 * `/hls/playlist.m3u8`, not `/hls/subscription/playlist.m3u8` — those are
 * unrelated subscription-content trailers on the same page) is a genuine
 * public HLS master playlist with variants confirmed live up to
 * 3840x2024 (4K) — a real quality upgrade over the MP4. previewUrl is kept
 * as a fallback for when the HLS extraction fails for any reason.
 */

const FETCH_TIMEOUT_MS = 4000;

interface ITunesResult {
  kind?: string;
  trackId?: number;
  trackName?: string;
  trackCensoredName?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  releaseDate?: string;
  country?: string;
}

/**
 * Fetches the tv.apple.com page trackViewUrl redirects to and extracts the
 * trailer's own HLS master playlist URL. Best-effort — any failure here
 * just means the caller falls back to the MP4 previewUrl instead.
 */
async function resolveHlsUrl(trackViewUrl: string, trackId: number): Promise<string | null> {
  try {
    const res = await fetch(trackViewUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.matchAll(/"hlsUrl":"(https:\/\/play-edge\.itunes\.apple\.com\/WebObjects\/MZPlayLocal\.woa\/hls\/playlist\.m3u8\?[^"]*)"/g);
    for (const m of matches) {
      const rawUrl = m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
      if (rawUrl.includes(`a=${trackId}`)) return rawUrl;
    }
    return null;
  } catch {
    return null;
  }
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
  // Network/timeout errors and non-2xx responses (a burst of resolve calls —
  // e.g. many carousel rows loading at once — was confirmed live to trip
  // Apple's own rate-limiting on this server's IP) are left to throw here
  // rather than resolving to null. The resolver's own try/catch treats a
  // thrown error as "skip caching" instead of "cache as no trailer" — a
  // transient failure must never bake a false negative into the 24h cache
  // for a title that genuinely has a trailer.
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`iTunes search returned ${res.status}`);
  const data = await res.json();
  const results: ITunesResult[] = Array.isArray(data?.results) ? data.results : [];

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

  if (best.trackViewUrl && best.trackId) {
    const hlsUrl = await resolveHlsUrl(best.trackViewUrl, best.trackId);
    if (hlsUrl) {
      return {
        provider: "apple",
        playbackType: "hls",
        url: hlsUrl,
        type: "trailer",
        language: null,
      };
    }
  }

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
