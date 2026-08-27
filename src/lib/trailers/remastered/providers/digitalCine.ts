import type { PremiumTrailerCandidate } from "../types";
import { resolveForProvider } from "../providerHelpers";

export async function resolveDigitalCine(
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  return resolveForProvider("digitalCine", title, originalTitle, year, locale);
}
