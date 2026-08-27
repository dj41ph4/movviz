import type { PremiumTrailerCandidate } from "../types";
import { resolveForProvider } from "../providerHelpers";

export async function resolveHdRetroTrailers(
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  return resolveForProvider("hdRetroTrailers", title, originalTitle, year, locale);
}
