"use client";

import useSWR from "swr";
import { useRemasteredTrailers } from "@/lib/settings/useRemasteredTrailers";
import { pickSearchTitle } from "@/lib/library/matching";
import type { PremiumTrailerCandidate } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { candidates: [] }));

/**
 * Premium remastered resolver — seulement si le toggle global est ON.
 * Clé SWR conditionnelle null => aucune requête HTTP quand OFF (spec §21).
 */
export function useRemasteredTrailerSources(
  type: "movie" | "series",
  tmdbId: number | null,
  title: string | null,
  originalTitle: string | null | undefined,
  year: number | null,
  originalLanguage: string | null | undefined,
  context: "carousel" | "details",
  locale?: string,
): PremiumTrailerCandidate[] {
  const { enabled } = useRemasteredTrailers();
  const searchTitle = title ? pickSearchTitle(title, originalTitle) : null;
  const key =
    enabled && tmdbId && searchTitle
      ? `/api/trailers/remastered/resolve?type=${type}&tmdbId=${tmdbId}&title=${encodeURIComponent(searchTitle)}${originalTitle ? `&originalTitle=${encodeURIComponent(originalTitle)}` : ""}${year ? `&year=${year}` : ""}${locale ? `&locale=${locale}` : ""}${originalLanguage ? `&originalLanguage=${encodeURIComponent(originalLanguage)}` : ""}&context=${context}`
      : null;
  const { data } = useSWR<{ candidates: PremiumTrailerCandidate[] }>(key, fetcher, { revalidateOnFocus: false });
  return data?.candidates ?? [];
}
