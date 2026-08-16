"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { titlePageVideoEnabled?: boolean };
}

/**
 * Ambient trailer video on movie/series detail pages — absent (never
 * touched) defaults to true, preserving the existing "video plays
 * immediately" behavior for everyone until they explicitly opt out in
 * Settings.
 */
export function useTitlePageVideo() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.titlePageVideoEnabled ?? true;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, titlePageVideoEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titlePageVideoEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
