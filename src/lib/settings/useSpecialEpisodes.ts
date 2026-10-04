"use client";

import useSWR from "swr";

interface PreferencesData { prefs?: { specialEpisodesEnabled?: boolean }; }

/** Personal visibility of season 0 on the web; disabled by default. */
export function useSpecialEpisodes() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");
  const enabled = data?.prefs?.specialEpisodesEnabled ?? false;
  const setEnabled = async (next: boolean) => {
    const previous = data;
    mutate({ prefs: { ...data?.prefs, specialEpisodesEnabled: next } }, { revalidate: false });
    try {
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialEpisodesEnabled: next }),
      });
      if (!response.ok) throw new Error("Unable to save specials visibility");
      await mutate(await response.json(), { revalidate: false });
    } catch {
      await mutate(previous, { revalidate: true });
    }
  };
  return { enabled, loaded: data !== undefined, setEnabled };
}
