"use client";

import { useMemo } from "react";
import useSWR from "swr";

export type TitleArtworkRef = { tmdbId: number; type: "movie" | "series" };
export type TitleArtworkByKey = Record<string, {
  backdropPath: string | null;
  logoPath: string | null;
  /** True when the selected image already includes the title treatment. */
  titleEmbedded?: boolean;
}>;

// This is an internal transport chunk, never a product limit. Every unique
// ref passed to the hook is resolved; chunks simply prevent a 3,000-title
// library/search from becoming one oversized URL or a TMDb request storm.
const ARTWORK_REQUEST_CHUNK = 120;

/**
 * One page or row supplies all of its references once. This hook never runs
 * inside an individual card: that prevents a horizontal shelf from becoming
 * dozens of independent image API requests.
 */
export function useTitleArtworkBatch(refs: readonly TitleArtworkRef[], locale: string): TitleArtworkByKey {
  const allRefs = useMemo(() => {
    const unique = new Map<string, TitleArtworkRef>();
    for (const ref of refs) {
      if (!Number.isInteger(ref.tmdbId) || ref.tmdbId <= 0) continue;
      unique.set(`${ref.type}:${ref.tmdbId}`, ref);
    }
    return [...unique.values()];
  }, [refs, locale]);

  const requestKey = useMemo(
    () => allRefs.length ? `title-artwork:${locale}:${allRefs.map(({ type, tmdbId }) => `${type}:${tmdbId}`).join(",")}` : null,
    [allRefs, locale]
  );
  // keepPreviousData: the row lists feeding this batch (trending, recommended…)
  // can shift between refreshes, which changes requestKey and would otherwise
  // make SWR clear `data` to undefined for the instant it takes to refetch —
  // every card's logo (all keyed off this same batch) would flash to null in
  // sync across the whole page. Keeping the previous artwork on screen until
  // the new batch actually lands avoids that flash entirely.
  const { data } = useSWR<TitleArtworkByKey>(requestKey, async () => {
    const merged: TitleArtworkByKey = {};
    for (let start = 0; start < allRefs.length; start += ARTWORK_REQUEST_CHUNK) {
      const items = allRefs.slice(start, start + ARTWORK_REQUEST_CHUNK).map(({ type, tmdbId }) => `${type}:${tmdbId}`).join(",");
      const response = await fetch(`/api/metadata/images/batch?items=${encodeURIComponent(items)}&locale=${encodeURIComponent(locale)}`);
      if (!response.ok) continue;
      const payload = await response.json() as { artwork?: TitleArtworkByKey };
      Object.assign(merged, payload.artwork ?? {});
    }
    return merged;
  }, { keepPreviousData: true });
  return data ?? {};
}
