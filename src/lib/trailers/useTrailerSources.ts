"use client";

import useSWR from "swr";
import { useEnhancedTrailerSources } from "@/lib/settings/useEnhancedTrailerSources";
import type { TrailerSource } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { sources: [] }));

/**
 * Resolves Apple/IMDb direct-video candidates for the given title — only
 * fires the network request when the user's own enhancedTrailerSourcesEnabled
 * toggle is on (SWR's conditional-key pattern: null key = no fetch), so an
 * opted-out user never pays for this at all, not even a no-op request.
 */
export function useTrailerSources(
  type: "movie" | "series",
  tmdbId: number | null,
  title: string | null,
  year: number | null,
  imdbId: string | null
): TrailerSource[] {
  const { enabled } = useEnhancedTrailerSources();
  const key = enabled && tmdbId && title
    ? `/api/trailers/resolve?type=${type}&tmdbId=${tmdbId}&title=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}${imdbId ? `&imdbId=${encodeURIComponent(imdbId)}` : ""}`
    : null;
  const { data } = useSWR<{ sources: TrailerSource[] }>(key, fetcher, { revalidateOnFocus: false });
  return data?.sources ?? [];
}
