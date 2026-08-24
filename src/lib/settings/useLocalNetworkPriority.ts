"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { localNetworkPriorityEnabled?: boolean };
}

/**
 * Only meaningful alongside useCdnImages() being enabled — when a request
 * is detected as coming from the local network (see isLocalRequest.ts),
 * stay on the same-origin NAS route instead of reaching out to TMDb's CDN,
 * since there's no upload-bandwidth benefit inside the LAN. Defaults to
 * TRUE (unlike useCdnImages' own default): once someone opts into CDN-first
 * at all, protecting their local-network usage from needless internet
 * round-trips is the sensible default, not something to opt into separately.
 */
export function useLocalNetworkPriority() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.localNetworkPriorityEnabled ?? true;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, localNetworkPriorityEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ localNetworkPriorityEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
