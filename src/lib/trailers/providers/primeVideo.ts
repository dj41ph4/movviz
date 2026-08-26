import type { TrailerSource } from "../types";

/**
 * Same investigation as netflix.ts, against the same reference repo's
 * Prime Video service (Theryston/trailers-api, src/services/primeVideo/
 * index.js) — the only real, working implementation found. It locates the
 * title page via scraping Google search results (site:primevideo.com, no
 * official search API — fragile and against Google's own ToS on its own),
 * then calls Amazon's undocumented internal streaming API
 * (atv-ps.primevideo.com/cdp/catalog/GetPlaybackResources) while spoofing a
 * specific device ID. The response is a DASH manifest with video and audio
 * as separate representations, downloaded individually and muxed together
 * server-side with FFmpeg before they're playable.
 *
 * Same two disqualifiers as Netflix: this project doesn't do new FFmpeg
 * transcoding, and this plan's own rule is that a source needing
 * login/cookies/an internal authenticated-feeling API must return no
 * result. No simpler public-asset path (an Apple-previewUrl equivalent)
 * was found for Prime Video. Returns null unconditionally.
 */
export async function resolvePrimeVideoTrailer(
  _type: "movie" | "series",
  _title: string,
  _year: number | null
): Promise<TrailerSource | null> {
  return null;
}
