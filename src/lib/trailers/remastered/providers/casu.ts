import type { PremiumTrailerCandidate } from "../types";
import { resolveForProvider } from "../providerHelpers";

export async function resolveCasu(
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  return resolveForProvider("casu", title, originalTitle, year, locale);
}
