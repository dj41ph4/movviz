"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { cardVideoEnabled?: boolean };
}

/**
 * Carte hover — vidéo au survol, 30ms, au-dessus de l'image sous le logo.
 * Toggle dédié, défaut true, même flux YouTube que fiche.
 */
export function useCardVideo() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const enabled = data?.prefs?.cardVideoEnabled ?? true;
  const loaded = data !== undefined;

  const setEnabled = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, cardVideoEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardVideoEnabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded, setEnabled };
}
