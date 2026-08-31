"use client";

import useSWR from "swr";

interface CdnImagesData {
  enabled?: boolean;
}

/**
 * Posters/backdrops/logos load from TMDb's own CDN instead of Movviz's
 * same-origin NAS-backed cache. Server-wide (admin-set) since 2026-08 — a
 * bandwidth/load decision for the whole household/NAS, not a personal
 * preference. Every user reads the current value; only an admin can change
 * it (PATCH is admin-gated server-side; `setEnabled` is still exposed here
 * for the admin panel that calls it).
 */
export function useCdnImages() {
  const { data, mutate } = useSWR<CdnImagesData>("/api/settings/cdn-images");

  const enabled = data?.enabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ ...data, enabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/cdn-images", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
