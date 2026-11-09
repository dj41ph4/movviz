"use client";

import useSWR from "swr";

export type AutoPlaybackKey = "autoSkipIntro" | "autoSkipCredits" | "autoNextEpisode";

type PreferencesData = { prefs?: Partial<Record<AutoPlaybackKey, boolean>> };

/**
 * Enchaînements automatiques du lecteur (passer l'intro, passer le générique,
 * épisode suivant) — réglages de compte, partagés par toutes les plateformes
 * comme `useAutoSubtitles`. Tous désactivés tant que l'utilisateur ne les a
 * pas activés ; `loaded` évite d'agir avant d'avoir lu la vraie valeur.
 */
export function useAutoPlayback() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");
  const prefs = data?.prefs;

  const set = async (key: AutoPlaybackKey, next: boolean) => {
    mutate({ prefs: { ...prefs, [key]: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
    } finally {
      mutate();
    }
  };

  return {
    autoSkipIntro: prefs?.autoSkipIntro === true,
    autoSkipCredits: prefs?.autoSkipCredits === true,
    autoNextEpisode: prefs?.autoNextEpisode === true,
    loaded: data !== undefined,
    set,
  };
}
