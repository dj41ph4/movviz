"use client";

import useSWR from "swr";

interface TrailerSourcesData {
  enabled?: boolean;
}

/**
 * Apple/IMDb direct-video trailer sources instead of YouTube embeds — a
 * GLOBAL, admin-only server switch, not a per-user preference: confirmed
 * live ("si je l'active c'est actif pour tous") that flipping it must apply
 * to every user at once, unlike the Beta Player's admin-gate-plus-personal-
 * opt-in shape. setEnabled below still exists for the admin settings panel
 * to call — the API route itself rejects a non-admin PUT.
 */
export function useEnhancedTrailerSources() {
  const { data, mutate } = useSWR<TrailerSourcesData>("/api/settings/trailer-sources");

  const enabled = data?.enabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/trailer-sources", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
