"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useLogoRetry } from "@/lib/useLogoRetry";
import { bleachPresentationKey, type BleachPart } from "@/lib/metadata/bleachPresentation";

export type TitleArtworkRef = { tmdbId: number; type: "movie" | "series"; seriesPart?: BleachPart };
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
      unique.set(bleachPresentationKey(ref), ref);
    }
    return [...unique.values()];
  }, [refs, locale]);

  const requestKey = useMemo(
    () => allRefs.length ? `title-artwork:${locale}:${allRefs.map(bleachPresentationKey).join(",")}` : null,
    [allRefs, locale]
  );
  // keepPreviousData: the row lists feeding this batch (trending, recommended…)
  // can shift between refreshes, which changes requestKey and would otherwise
  // make SWR clear `data` to undefined for the instant it takes to refetch —
  // every card's logo (all keyed off this same batch) would flash to null in
  // sync across the whole page. Keeping the previous artwork on screen until
  // the new batch actually lands avoids that flash entirely.
  // Ask again (spaced out, capped) while a title came back with nothing at
  // all — a missing key or neither backdrop nor logo is a failed lookup, not
  // an answer. Titles that simply have no logo keep their backdrop and stop.
  const retry = useLogoRetry<TitleArtworkByKey>((data) => !!data && allRefs.every((ref) => {
    const entry = data[bleachPresentationKey(ref)];
    return !!entry && (entry.backdropPath != null || entry.logoPath != null);
  }));
  const { data } = useSWR<TitleArtworkByKey>(requestKey, async () => {
    const merged: TitleArtworkByKey = {};
    for (let start = 0; start < allRefs.length; start += ARTWORK_REQUEST_CHUNK) {
      const chunk = allRefs.slice(start, start + ARTWORK_REQUEST_CHUNK);
      const items = chunk.map(bleachPresentationKey).join(",");
      const url = `/api/metadata/images/batch?items=${encodeURIComponent(items)}&locale=${encodeURIComponent(locale)}`;
      // A chunk that fails is retried here; if it still fails its cards keep
      // their text stand-in and the refresh below asks again later.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(url, chunk.some(ref => ref.seriesPart) || attempt > 0 ? { cache: "no-store" } : undefined);
          if (!response.ok) throw new Error(String(response.status));
          const payload = await response.json() as { artwork?: TitleArtworkByKey };
          Object.assign(merged, payload.artwork ?? {});
          break;
        } catch {
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_500));
        }
      }
    }
    return merged;
  }, { keepPreviousData: true, refreshInterval: retry });
  return data ?? {};
}
