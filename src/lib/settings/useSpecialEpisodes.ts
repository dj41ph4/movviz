"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { specialEpisodesEnabled?: boolean };
}

/**
 * Season-0 "specials" in the watched-completion tracking — absent (never
 * touched) defaults to false: specials are EXCLUDED from "is this series
 * fully watched" by default, confirmed live as the actual expectation (a
 * series with every real season watched should read as complete even if a
 * special was never released or watched).
 */
export function useSpecialEpisodes() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.specialEpisodesEnabled ?? false;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, specialEpisodesEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialEpisodesEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
