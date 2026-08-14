"use client";

import useSWR from "swr";
import { useI18n } from "@/i18n/provider";
import type { PreferredAudioLanguage } from "@/lib/userPrefs/languages";

interface PreferencesData {
  prefs?: { preferredAudioLanguage?: PreferredAudioLanguage };
}

/**
 * Langue audio préférée pour le choix de piste par défaut du lecteur —
 * distincte de la langue d'interface (`locale`) : un utilisateur peut lire
 * Movviz en français tout en préférant l'audio anglais, par exemple.
 * Absente par défaut → retombe sur `locale` (comportement historique).
 */
export function usePreferredAudioLanguage() {
  const { locale } = useI18n();
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const value = data?.prefs?.preferredAudioLanguage ?? "auto";
  const effective = value === "auto" ? locale : value;
  const loaded = data !== undefined;

  const set = async (next: PreferredAudioLanguage) => {
    mutate({ prefs: { ...data?.prefs, preferredAudioLanguage: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferredAudioLanguage: next }),
      });
    } finally {
      mutate();
    }
  };

  return { value, effective, loaded, set };
}
