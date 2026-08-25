"use client";

import useSWR from "swr";

interface CdnImagesData {
  localNetworkPriorityEnabled?: boolean;
}

/**
 * Only meaningful alongside useCdnImages() being enabled — when a request
 * is detected as coming from the local network (see isLocalRequest.ts),
 * stay on the same-origin NAS route instead of reaching out to TMDb's CDN.
 * Server-wide (admin-set) since 2026-08, same store as useCdnImages — see
 * its doc comment for why this moved out of per-user preferences.
 */
export function useLocalNetworkPriority() {
  const { data, mutate } = useSWR<CdnImagesData>("/api/settings/cdn-images");

  const enabled = data?.localNetworkPriorityEnabled ?? true;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ ...data, localNetworkPriorityEnabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/cdn-images", {
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
