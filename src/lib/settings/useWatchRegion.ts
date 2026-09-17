"use client";

import useSWR from "swr";

interface PreferencesData {
  prefs?: { watchRegion?: string };
}

/** Pays les plus pertinents pour un catalogue TMDb francophone/européen —
 *  pas les ~250 pays ISO-3166, juste ceux qu'un utilisateur Movviz est
 *  susceptible de choisir. La valeur reste un simple code ISO stocké tel
 *  quel, donc rien n'empêche d'en ajouter d'autres plus tard. */
export const WATCH_REGION_OPTIONS = ["FR", "BE", "CH", "LU", "CA", "GB", "US", "DE", "ES", "IT", "NL"] as const;

const DEFAULT_WATCH_REGION = "FR";

/**
 * Région de streaming (ISO-3166-1 alpha-2) utilisée pour les catalogues
 * provider (Netflix/Disney+/Prime) et les badges "où regarder" — distincte
 * de la langue d'interface, qui ne permet pas de distinguer un utilisateur
 * français d'un utilisateur belge francophone (audit refonte
 * recommandations, 2026-09 : le hardcode "FR" donnait le mauvais catalogue
 * à un compte belge).
 */
export function useWatchRegion() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");

  const value = data?.prefs?.watchRegion ?? DEFAULT_WATCH_REGION;
  const loaded = data !== undefined;

  const set = async (next: string) => {
    mutate({ prefs: { ...data?.prefs, watchRegion: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ watchRegion: next }),
      });
    } finally {
      mutate();
    }
  };

  return { value, loaded, set };
}
