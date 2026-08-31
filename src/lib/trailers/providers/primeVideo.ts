import { titleSimilarity } from "@/lib/library/matching";
import type { TrailerSource } from "../types";

/**
 * Live-verified during implementation, no auth of any kind:
 * - `primevideo.com/search/ref=atv_nb_sr?phrase=...` returns a page with a
 *   `<script id="dv-web-page-hydration-data" type="application/json">`
 *   block — real, parseable JSON (not scraped Google results, unlike the
 *   only reference implementation found) listing entities with
 *   `displayTitle`, `entityType` ("Movie" or "TV Show"), and `impressionId`
 *   (the amzn1.dv.gti.* id GetPlaybackResources expects as `titleId`).
 * - `atv-ps.primevideo.com/cdp/catalog/GetPlaybackResources` with
 *   `videoMaterialType=Trailer` and no auth returns a real DASH manifest.
 * - Downloaded an actual video segment from that manifest and confirmed
 *   with `file`: "ISO Media, MPEG v4 system, Dynamic Adaptive Streaming
 *   over HTTP" — a plain, unencrypted MP4/DASH segment, HTTP 206, no
 *   cookies, no login. `grep`ing the full manifest for ContentProtection/
 *   Widevine/PlayReady/cenc found zero matches — genuinely clear content,
 *   not just a DRM-capable profile that happens not to be exercised.
 *
 * The reference repo (Theryston/trailers-api) downloads video+audio
 * separately and muxes them with FFmpeg only because its goal is a single
 * downloadable MP4 file. Movviz doesn't need that — dash.js plays the MPD
 * (with its separate audio/video adaptation sets) directly in the browser,
 * same as it already does for the beta player's own DASH leg.
 *
 * Movies only for now, same limitation as apple.ts but for a different
 * reason: search results DO include "TV Show" entities with real
 * impressionIds, but GetPlaybackResources rejects a show's own top-level id
 * with a plain "Cannot complete request" — confirmed live on The Boys. A
 * series trailer is tied to a specific season/episode id there, not the
 * show itself, and resolving which season adds real complexity for an
 * unverified payoff — not worth guessing at without testing it for real.
 */

const FETCH_TIMEOUT_MS = 4000;
const MIN_TITLE_SIMILARITY = 0.82;

interface PrimeEntity {
  displayTitle?: string;
  entityType?: string;
  impressionId?: string;
}

async function searchTitleId(title: string): Promise<string | null> {
  const url = `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`Prime Video search returned ${res.status}`);
  const html = await res.text();

  const scriptMatch = html.match(/<script id="dv-web-page-hydration-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;

  let data: any;
  try {
    data = JSON.parse(scriptMatch[1]);
  } catch {
    return null;
  }

  const containers = data?.init?.preparations?.body?.containers ?? [];
  const entities: PrimeEntity[] = containers.flatMap((c: any) => c.entities ?? []);

  let best: PrimeEntity | null = null;
  let bestScore = 0;
  for (const e of entities) {
    if (e.entityType !== "Movie" || !e.displayTitle || !e.impressionId) continue;
    const score = titleSimilarity(title, e.displayTitle);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }

  return best && bestScore >= MIN_TITLE_SIMILARITY ? best.impressionId! : null;
}

export async function resolvePrimeVideoTrailer(
  type: "movie" | "series",
  title: string,
  _year: number | null
): Promise<TrailerSource | null> {
  if (type !== "movie") return null;
  const titleId = await searchTitleId(title);
  if (!titleId) return null;

  const params = new URLSearchParams({
    deviceTypeID: "AOAGZA014O5RE",
    firmware: "1",
    consumptionType: "Streaming",
    desiredResources: "PlaybackUrls",
    resourceUsage: "ImmediateConsumption",
    videoMaterialType: "Trailer",
    titleId,
    audioTrackId: "ALL",
    deviceStreamingTechnologyOverride: "DASH",
  });
  const res = await fetch(`https://atv-ps.primevideo.com/cdp/catalog/GetPlaybackResources?${params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Prime Video GetPlaybackResources returned ${res.status}`);
  const data = await res.json();
  if (data.error) return null;

  const urlSets = data.playbackUrls?.urlSets;
  if (!urlSets) return null;

  // Prefer an HD urlSet when more than one quality is offered.
  const entries = Object.values(urlSets) as any[];
  const best = entries.find((u) => u.urls?.manifest?.videoQuality === "HD") ?? entries[0];
  const mpdUrl = best?.urls?.manifest?.url;
  if (!mpdUrl) return null;

  return {
    provider: "primeVideo",
    playbackType: "dash",
    url: mpdUrl,
    type: "trailer",
    language: null,
  };
}
