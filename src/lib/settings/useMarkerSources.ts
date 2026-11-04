"use client";

import useSWR from "swr";

export type MarkerSourceMode = "all" | "plex-only" | "api-only";

interface MarkerSourcesData {
  mode?: MarkerSourceMode;
  effectiveMode?: MarkerSourceMode;
  plexLinked?: boolean;
}

/** Réglage global (administrateur) : d'où viennent les repères de saut —
 *  « Tout » (Plex puis TheIntroDB), « Plex uniquement » ou « API uniquement ».
 *  Sans Plex lié, seul « API uniquement » existe : le mode effectif l'est. */
export function useMarkerSources() {
  const { data, mutate } = useSWR<MarkerSourcesData>("/api/settings/marker-sources");

  const plexLinked = data?.plexLinked ?? false;
  const effectiveMode: MarkerSourceMode = data?.effectiveMode ?? "plex-only";
  const loaded = data !== undefined;

  const setMode = async (next: MarkerSourceMode) => {
    mutate({ ...data, mode: next, effectiveMode: plexLinked ? next : "api-only" }, { revalidate: false });
    try {
      await fetch("/api/settings/marker-sources", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } finally {
      mutate();
    }
  };

  return { effectiveMode, plexLinked, loaded, setMode };
}
