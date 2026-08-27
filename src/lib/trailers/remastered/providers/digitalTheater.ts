import type { PremiumTrailerCandidate } from "../types";
import { resolveForProvider } from "../providerHelpers";

/**
 * The Digital Theater — primarily quality-driven (1080p/4K), often EN/VO.
 * For now uses the same YouTube trusted-channel path; direct MP4/HLS
 * extraction can be added later without changing the resolver contract.
 */
export async function resolveDigitalTheater(
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  return resolveForProvider("digitalTheater", title, originalTitle, year, locale);
}
