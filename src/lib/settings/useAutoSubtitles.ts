"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { autoSubtitles?: boolean };
}

/**
 * Sous-titres automatiques du profil — réglage de compte (même magasin que la
 * langue audio préférée), donc partagé par toutes les plateformes : le
 * changer sur Android le change sur le bureau et inversement. Désactivé tant
 * que l'utilisateur ne l'a pas activé.
 */
export function useAutoSubtitles() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");
  const enabled = data?.prefs?.autoSubtitles === true;

  const set = async (next: boolean) => {
    mutate({ prefs: { ...data?.prefs, autoSubtitles: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoSubtitles: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded: data !== undefined, set };
}
