import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { plexConfigured } from "@/lib/plex/store";
import type { PlaybackMarkerSource } from "@/lib/playback/markers/types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "marker-sources.json");

/**
 * D'où viennent les repères de saut (récap, intro, générique, aperçu) :
 *  - "all"       : Plex quand il les a (intro et générique), et TheIntroDB qui
 *    comble les trous et fournit ce que Plex n'a pas (récap, aperçu) ;
 *  - "plex-only" : uniquement ceux de Plex — aucune requête vers un tiers ;
 *  - "api-only"  : uniquement TheIntroDB — Plex n'est pas interrogé pour ça
 *    (sa tâche planifiée est alors en pause).
 *
 * Réglage GLOBAL, administrateur seulement. Défaut "plex-only" : aucune
 * nouvelle requête sortante tant que l'administrateur ne l'a pas choisi.
 */
export type MarkerSourceMode = "all" | "plex-only" | "api-only";

export function getMarkerSourceMode(): MarkerSourceMode {
  const stored = readJsonCached<{ mode?: unknown }>(FILE, {}).mode;
  if (stored === "all" || stored === "multisource") return "all";
  return stored === "api-only" ? "api-only" : "plex-only";
}

export function setMarkerSourceMode(mode: MarkerSourceMode): void {
  writeJsonCached(FILE, { mode });
}

/** Mode réellement appliqué : sans Plex lié, ni « Tout » ni « Plex uniquement »
 *  n'ont de sens — la source externe est alors la seule possible. */
export function effectiveMarkerSourceMode(): MarkerSourceMode {
  return plexConfigured() ? getMarkerSourceMode() : "api-only";
}

/** Plex fournit des repères (et sa tâche planifiée tourne). */
export function plexMarkersEnabled(): boolean {
  return effectiveMarkerSourceMode() !== "api-only";
}

/** TheIntroDB fournit des repères (requêtes sortantes autorisées). */
export function externalMarkersEnabled(): boolean {
  return effectiveMarkerSourceMode() !== "plex-only";
}

/** Sources lues à la lecture, de la plus prioritaire à la moins prioritaire. */
export function markerSourcePriority(): readonly PlaybackMarkerSource[] {
  switch (effectiveMarkerSourceMode()) {
    case "plex-only": return ["plex"];
    case "api-only": return ["theintrodb"];
    default: return ["plex", "theintrodb"];
  }
}
