"use client";

import useSWR from "swr";

interface RemasteredTrailersData {
  enabled?: boolean;
}

/**
 * Global, admin-only server switch for HD remastered/re-trailer premium
 * resolver. Isolated from enhancedTrailerSources — separate file, separate
 * toggle, same GLOBAL semantics (active for all users when admin enables).
 */
export function useRemasteredTrailers() {
  const { data, mutate } = useSWR<RemasteredTrailersData>("/api/settings/remastered-trailers");

  const enabled = data?.enabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/remastered-trailers", {
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
