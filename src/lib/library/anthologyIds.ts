/**
 * Anthologies Plex — table pure (sans accès disque), partagée par le serveur
 * (anthology.ts) et l'interface (bouton « Ranger comme dans Plex »).
 * TMDb id de chaque série → numéro de saison dans l'anthologie.
 */
export interface Anthology {
  /** Dossier de la série sur le disque — celui que Plex associe déjà à l'anthologie. */
  folder: string;
  seasons: Record<number, number>;
}

export const ANTHOLOGIES: Anthology[] = [
  // « Monster » tout court existe déjà : c'est l'anime Monster (2004).
  { folder: "Monster (2022)", seasons: { 113988: 1, 225634: 2, 286801: 3, 299939: 4 } },
];

export function anthologyFor(tmdbId: number): { anthology: Anthology; season: number } | null {
  for (const anthology of ANTHOLOGIES) {
    const season = anthology.seasons[tmdbId];
    if (season != null) return { anthology, season };
  }
  return null;
}
