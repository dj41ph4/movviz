"use client";

import useSWR from "swr";
import { useEnhancedTrailerSources } from "@/lib/settings/useEnhancedTrailerSources";
import { pickSearchTitle } from "@/lib/library/matching";
import type { TrailerSource } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { sources: [] }));

/**
 * Resolves Apple/IMDb/Prime Video direct-video candidates — only fires the
 * network request when the user's own enhancedTrailerSourcesEnabled toggle
 * is on (SWR's conditional-key pattern: null key = no fetch), so an
 * opted-out user never pays for this at all, not even a no-op request.
 *
 * Queries with pickSearchTitle(title, originalTitle) — the LOCALIZED title
 * alone (e.g. French "L'Idée d'être avec toi") was confirmed live to find
 * nothing on Apple/Prime, which catalog under the original English title
 * ("The Idea of You") almost every time; same reasoning the indexer search
 * already uses this exact helper for (see matching.ts's own doc comment).
 */
export function useTrailerSources(
  type: "movie" | "series",
  tmdbId: number | null,
  title: string | null,
  originalTitle: string | null | undefined,
  year: number | null,
  imdbId: string | null
): TrailerSource[] {
  const { enabled } = useEnhancedTrailerSources();
  const searchTitle = title ? pickSearchTitle(title, originalTitle) : null;
  const key = enabled && tmdbId && searchTitle
    ? `/api/trailers/resolve?type=${type}&tmdbId=${tmdbId}&title=${encodeURIComponent(searchTitle)}${year ? `&year=${year}` : ""}${imdbId ? `&imdbId=${encodeURIComponent(imdbId)}` : ""}`
    : null;
  const { data } = useSWR<{ sources: TrailerSource[] }>(key, fetcher, { revalidateOnFocus: false });
  return data?.sources ?? [];
}
