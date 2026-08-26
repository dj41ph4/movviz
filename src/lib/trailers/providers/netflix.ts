import type { TrailerSource } from "../types";

/**
 * Re-investigated live after an initial, too-pessimistic rejection (the
 * user correctly pushed back that "the manifest requests a PlayReady
 * profile" isn't proof the returned stream is actually DRM-encrypted).
 * Reproduced the reference implementation's exact flow (Theryston/
 * trailers-api, src/services/netflix/index.js) by hand: GET a public
 * netflix.com title page, capture the anonymous Set-Cookie from that same
 * response (never a user's own login), extract a Supplemental videoId from
 * the embedded reactContext, then POST that videoId to Netflix's own
 * playapi/cadmium/manifest/1 with the same profile list the reference code
 * sends.
 *
 * The real response was a hard account-level rejection —
 * `{"error":{"code":"RESTRICTED_TO_TESTERS","display":"Sorry, your account
 * can't be used on this device"}}` — never reaching the point where a
 * DRM/clear-stream distinction would even matter. This is a genuine gate on
 * anonymous access to that API today (possibly tightened since the
 * reference project last verified it, or region-dependent), not the
 * cookie/DRM assumption this file originally (incorrectly) cited. Prime
 * Video's equivalent API has no such gate — see primeVideo.ts, which is
 * real. Returns null unconditionally; revisit if Netflix's restriction
 * changes, but a real user's own Netflix login must never be the answer.
 */
export async function resolveNetflixTrailer(
  _type: "movie" | "series",
  _title: string,
  _year: number | null
): Promise<TrailerSource | null> {
  return null;
}
