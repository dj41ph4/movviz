import type { TrailerSource } from "../types";

/**
 * Live-verified during implementation: a plain server-side fetch of any
 * www.imdb.com page (including /title/{id}/) is intercepted by an AWS WAF
 * bot challenge — HTTP 202, empty body, `x-amzn-waf-action: challenge`,
 * every time, regardless of User-Agent. There is no cookie/token dance that
 * fixes this from a stateless server-side fetch. IMDb's own unauthenticated
 * suggestion API (v3.sg.media-imdb.com) works but only returns search
 * metadata, never trailer video URLs — so it can't complete this provider.
 *
 * Kept as a real fallback slot (not deleted) because IMDb's WAF posture can
 * change, and a working alternate extraction method may surface later — but
 * today this always returns null, which is safe: the resolver treats that
 * exactly like "no IMDb trailer found" and moves on to the existing
 * YouTube chain. Never remove the timeout/AbortSignal below if this is
 * revisited — the WAF's 202 response can otherwise hang a naive fetch.
 */
export async function resolveImdbTrailer(
  _type: "movie" | "series",
  _imdbId: string | null
): Promise<TrailerSource | null> {
  return null;
}
