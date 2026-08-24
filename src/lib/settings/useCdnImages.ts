"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { cdnImagesEnabled?: boolean };
}

/**
 * Posters/backdrops/logos load from TMDb's own CDN instead of Movviz's
 * same-origin NAS-backed cache. Absent (never touched) defaults to FALSE —
 * unlike other Experience toggles, the safe/current behavior is the
 * default here on purpose (explicit user request): nothing changes for
 * anyone until they opt in.
 */
export function useCdnImages() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.cdnImagesEnabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, cdnImagesEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cdnImagesEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
