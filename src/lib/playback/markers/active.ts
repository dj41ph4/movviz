/**
 * Choix du marqueur « actif » à la position courante — logique unique du
 * lecteur web, reproduite à l'identique dans les clients Android NX TV,
 * Android NX mobile et Tizen (voir leurs commentaires « même règle »).
 *
 * Plusieurs marqueurs peuvent se chevaucher (une avant-première pendant le
 * générique, un récap qui déborde sur l'intro). Un seul bouton est affiché :
 * celui du type le plus prioritaire, puis le plus tôt commencé. Le
 * générique passe avant l'avant-première : sauter le générique mène à
 * l'épisode suivant, ce qu'on cherche à cet endroit.
 *
 * Un type inconnu (venu d'une version plus récente du serveur) est ignoré,
 * jamais affiché avec un libellé faux.
 */

export const MARKER_SKIP_PRIORITY = ["recap", "intro", "credits", "preview"] as const;

export type SkippableMarkerType = (typeof MARKER_SKIP_PRIORITY)[number];

export function pickActiveMarker<T extends { type: string; startMs: number; endMs: number }>(
  markers: readonly T[],
  positionMs: number,
): T | null {
  let best: T | null = null;
  let bestRank = Infinity;
  for (const m of markers) {
    const rank = (MARKER_SKIP_PRIORITY as readonly string[]).indexOf(m.type);
    if (rank < 0) continue;
    if (!(positionMs >= m.startMs && positionMs < m.endMs)) continue;
    if (rank < bestRank || (rank === bestRank && best && m.startMs < best.startMs)) {
      best = m;
      bestRank = rank;
    }
  }
  return best;
}

/** Clé i18n du libellé du bouton de saut pour un type de marqueur. */
export function markerSkipLabelKey(type: SkippableMarkerType): string {
  switch (type) {
    case "recap": return "player.skipRecap";
    case "intro": return "player.skipIntro";
    case "credits": return "player.skipCredits";
    case "preview": return "player.skipPreview";
  }
}
