"use client";

import useSWR from "swr";

/** One fetch per session (SWR's default dedupe already prevents refetching
 *  on every mount) — the network a browser is on doesn't change mid-session.
 *  `enabled` gates the fetch entirely: most users never turn on CDN images
 *  at all, so this never calls the API for them (see useShouldUseCdn). */
export function useIsLocalNetwork(enabled: boolean): boolean {
  const { data } = useSWR<{ isLocal: boolean }>(enabled ? "/api/settings/network-context" : null, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  return data?.isLocal ?? false;
}
