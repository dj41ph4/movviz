"use client";

import { useMemo } from "react";
import useSWR from "swr";

export type TitleArtworkRef = { tmdbId: number; type: "movie" | "series" };
export type TitleArtworkByKey = Record<string, {
  backdropPath: string | null;
  logoPath: string | null;
}>;

const MAX_TITLE_ARTWORK_REFS = 160;

/**
 * One page or row supplies all of its references once. This hook never runs
 * inside an individual card: that prevents a horizontal shelf from becoming
 * dozens of independent image API requests.
 */
export function useTitleArtworkBatch(refs: readonly TitleArtworkRef[], locale: string): TitleArtworkByKey {
  const request = useMemo(() => {
    const unique = new Map<string, TitleArtworkRef>();
    for (const ref of refs) {
      if (!Number.isInteger(ref.tmdbId) || ref.tmdbId <= 0) continue;
      unique.set(`${ref.type}:${ref.tmdbId}`, ref);
      if (unique.size === MAX_TITLE_ARTWORK_REFS) break;
    }
    if (unique.size === 0) return null;
    const items = [...unique.values()].map(({ type, tmdbId }) => `${type}:${tmdbId}`).join(",");
    return `/api/metadata/images/batch?items=${encodeURIComponent(items)}&locale=${encodeURIComponent(locale)}`;
  }, [refs, locale]);

  const { data } = useSWR<{ artwork: TitleArtworkByKey }>(request);
  return data?.artwork ?? {};
}
