"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { enhancedTrailerSourcesEnabled?: boolean };
}

/**
 * Apple TV/IMDb direct-video trailer sources instead of YouTube embeds —
 * absent (never touched) defaults to false, keeping today's YouTube-only
 * behavior for everyone until they explicitly opt in in Settings.
 */
export function useEnhancedTrailerSources() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.enhancedTrailerSourcesEnabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, enhancedTrailerSourcesEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enhancedTrailerSourcesEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
