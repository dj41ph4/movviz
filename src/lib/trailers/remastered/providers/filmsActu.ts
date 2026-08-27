import type { PremiumTrailerCandidate } from "../types";
import { resolveForProvider } from "../providerHelpers";

export async function resolveFilmsActu(
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  return resolveForProvider("filmsActu", title, originalTitle, year, locale);
}
