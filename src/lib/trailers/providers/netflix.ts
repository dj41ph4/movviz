import type { TrailerSource } from "../types";

/**
 * Investigated live before writing this stub (see also imdb.ts) — read the
 * only real, working reference implementation in full (Theryston/
 * trailers-api, github.com/Theryston/trailers-api/blob/main/src/services/
 * netflix/index.js). What it actually does, contrary to what "public
 * trailer page" suggests: loads a netflix.com page to capture session
 * cookies (even logged-out, Netflix still sets them), then calls Netflix's
 * own undocumented internal streaming API
 * (netflix.com/playapi/cadmium/manifest/1) requesting a PlayReady DASH
 * profile — i.e. negotiating a DRM-capable stream, not fetching a plain
 * public asset. Video and audio arrive as separate DASH representations
 * that have to be muxed server-side with FFmpeg before they're a single
 * playable file. Also checked Netflix Tudum (netflix.com/tudum/videos/...,
 * the plan's suggested "cleaner" public alternative) directly: its pages
 * only reference the same internal Netflix catalog videoId, no shortcut.
 *
 * That combination — cookies, a DRM-profile request, and required FFmpeg
 * remuxing — fails this project's own constraints twice over: no new
 * FFmpeg transcoding (established in the original trailer-resolver plan),
 * and this plan's own rule that a source needing cookies/DRM must return
 * no result. It also has no real public-asset equivalent to Apple's iTunes
 * previewUrl to fall back to. Returns null unconditionally rather than
 * implementing cookie/DRM-negotiation logic that would violate both rules.
 */
export async function resolveNetflixTrailer(
  _type: "movie" | "series",
  _title: string,
  _year: number | null
): Promise<TrailerSource | null> {
  return null;
}
