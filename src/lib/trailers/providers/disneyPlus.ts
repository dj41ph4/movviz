import type { TrailerSource } from "../types";

/**
 * Unlike Netflix/Prime Video, the plan provided no working reference
 * implementation for Disney+ at all — no equivalent in Theryston/
 * trailers-api, and no other real, verified public trailer-extraction
 * technique was found during the same investigation pass. Disney+'s
 * catalog pages are authenticated even for browsing in most regions, with
 * nothing resembling Apple's public, unauthenticated iTunes previewUrl.
 * Returns null unconditionally rather than guessing at an unverified
 * scraping technique — consistent with this project's standing rule to
 * never ship an unverified theory.
 */
export async function resolveDisneyPlusTrailer(
  _type: "movie" | "series",
  _title: string,
  _year: number | null
): Promise<TrailerSource | null> {
  return null;
}
