import { createHash } from "node:crypto";
import type { PlaybackMarker } from "./types";

/** Empreinte déterministe des marqueurs d'UNE source (déjà triés par
 *  startMs — l'ordre fait partie du contrat) : permet de ne rien réécrire si
 *  la source répond la même chose. */
export function markerSignature(markers: PlaybackMarker[]): string {
  const canonical = JSON.stringify(
    markers.map((m) => ({ t: m.type, s: m.startMs, e: m.endMs, f: m.final }))
  );
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
