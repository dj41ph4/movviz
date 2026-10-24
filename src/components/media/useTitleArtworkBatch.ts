"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { useLogoRetry } from "@/lib/useLogoRetry";
import { bleachPresentationKey, type BleachPart } from "@/lib/metadata/bleachPresentation";
import { browserArtworkSnapshot, emptyBrowserArtwork, readBrowserArtwork, subscribeBrowserArtwork, writeBrowserArtwork } from "./artworkBrowserCache";

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
const ARTWORK_REQUEST_CHUNK = 24;

/**
 * One page or row supplies all of its references once. This hook never runs
 * inside an individual card: that prevents a horizontal shelf from becoming
 * dozens of independent image API requests.
 */
export function useTitleArtworkBatch(refs: readonly TitleArtworkRef[], locale: string): TitleArtworkByKey {
  // React uses an empty server snapshot for hydration, then picks up the
  // selected language's browser mapping without showing old-language logos.
  const browserArtwork = useSyncExternalStore(subscribeBrowserArtwork, () => browserArtworkSnapshot(locale), emptyBrowserArtwork);
  const [freshArtwork, setFreshArtwork] = useState<{ locale: string; entries: TitleArtworkByKey }>({ locale, entries: {} });
  const allRefs = useMemo(() => {
    const unique = new Map<string, TitleArtworkRef>();
    for (const ref of refs) {
      if (!Number.isInteger(ref.tmdbId) || ref.tmdbId <= 0) continue;
      unique.set(bleachPresentationKey(ref), ref);
    }
    return [...unique.values()];
  }, [refs]);

  const requestKey = useMemo(
    () => allRefs.length ? `title-artwork:${locale}:${allRefs.map(bleachPresentationKey).join(",")}` : null,
    [allRefs, locale]
  );
  // Browser mappings keep stable rows visible while a changed request key is
  // being resolved. SWR must not keep data from the previous language.
  // Ask again (spaced out, capped) while a title came back with nothing at
  // all — a missing key or neither backdrop nor logo is a failed lookup, not
  // an answer. Titles that simply have no logo keep their backdrop and stop.
  const retry = useLogoRetry<TitleArtworkByKey>((data) => !!data && allRefs.every((ref) => {
    const entry = data[bleachPresentationKey(ref)];
    return !!entry && (entry.backdropPath != null || entry.logoPath != null);
  }));
  const { data } = useSWR<TitleArtworkByKey>(requestKey, async () => {
    const cached = readBrowserArtwork(locale);
    const merged: TitleArtworkByKey = {};
    const missingRefs = allRefs.filter((ref) => {
      const key = bleachPresentationKey(ref);
      if (!cached[key]) return true;
      merged[key] = cached[key];
      return false;
    });
    for (let start = 0; start < missingRefs.length; start += ARTWORK_REQUEST_CHUNK) {
      const chunk = missingRefs.slice(start, start + ARTWORK_REQUEST_CHUNK);
      const items = chunk.map(bleachPresentationKey).join(",");
      const url = `/api/metadata/images/batch?items=${encodeURIComponent(items)}&locale=${encodeURIComponent(locale)}`;
      // A chunk that fails is retried here; if it still fails its cards keep
      // their text stand-in and the refresh below asks again later.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(url, chunk.some(ref => ref.seriesPart) || attempt > 0 ? { cache: "no-store" } : undefined);
          if (!response.ok) throw new Error(String(response.status));
          const payload = await response.json() as { artwork?: TitleArtworkByKey };
          const received = payload.artwork ?? {};
          Object.assign(merged, received);
          if (Object.keys(received).length) {
            setFreshArtwork((previous) => ({ locale, entries: { ...(previous.locale === locale ? previous.entries : {}), ...received } }));
            writeBrowserArtwork(locale, received);
          }
          break;
        } catch {
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_500));
        }
      }
    }
    return merged;
  }, { refreshInterval: retry });
  // Fresh chunks arrive before the whole batch settles. Each language keeps
  // its own mapping; the stored browser mapping is available synchronously.
  return { ...browserArtwork, ...data, ...(freshArtwork.locale === locale ? freshArtwork.entries : {}) };
}
