"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { isForegroundDataUrl, withForegroundRequest } from "./foregroundRequests";

/** Track missing useful data, never cached refreshes or speculative prefetch. */
export function useForegroundFetcher<T>(fetcher: (url: string) => Promise<T>) {
  const { cache } = useSWRConfig();
  return useCallback((url: string) => {
    if (!isForegroundDataUrl(url) || cache.get(url)?.data !== undefined) return fetcher(url);
    return withForegroundRequest(() => fetcher(url));
  }, [cache, fetcher]);
}
