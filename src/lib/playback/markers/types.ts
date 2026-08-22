/**
 * Marqueurs de navigation temporelle génériques (intros, génériques) —
 * couche au-dessus du playback existant, jamais un pipeline vidéo.
 *
 * Le modèle est VOLONTAIREMENT neutre : la source actuelle est Plex
 * (analyse intro/credits du serveur), mais demain une saisie manuelle
 * Movviz, TheIntroDB ou une analyse maison pourrait alimenter le même
 * store sans toucher ni l'API ni Android TV.
 */

export type PlaybackMarkerType = "intro" | "credits";

export interface PlaybackMarker {
  id: string;
  /** Source d'origine des données — seul "plex" existe en V1. */
  source: "plex";
  /** Id du marker côté source, conservé à titre informatif/diagnostic. */
  sourceMarkerId: string | null;
  type: PlaybackMarkerType;
  startMs: number;
  endMs: number;
  final: boolean;
}

/** Un enregistrement par ratingKey — lookup O(1), écriture isolée de la
 *  bibliothèque (les markers ont leur propre cycle de synchronisation et
 *  library-series.json peut être énorme : ne jamais y ranger ces données). */
export interface MediaMarkerRecord {
  ratingKey: string;
  markers: PlaybackMarker[];
  /** Empreinte déterministe du contenu — compare sans réécrire si
   *  identique (voir markerSync.ts). */
  signature: string;
  /** updatedAt Plex vu lors de la dernière sync réussie (unix sec). */
  plexUpdatedAt: number | null;
  lastSyncedAt: number;
}

export interface PlaybackMarkerStore {
  version: 1;
  byRatingKey: Record<string, MediaMarkerRecord>;
}

export function emptyPlaybackMarkerStore(): PlaybackMarkerStore {
  return { version: 1, byRatingKey: {} };
}

/**
 * Migration volontairement triviale en V1 mais présente dès maintenant :
 * ne pas figer le format du fichier pour toujours. Un jour un champ
 * évolue → on gère ici au lieu de casser tous les stores existants.
 */
export function migrateMarkerStore(raw: unknown): PlaybackMarkerStore {
  if (!raw || typeof raw !== "object") return emptyPlaybackMarkerStore();
  const r = raw as Partial<PlaybackMarkerStore>;
  if (r.version !== 1 || !r.byRatingKey || typeof r.byRatingKey !== "object") {
    return emptyPlaybackMarkerStore();
  }
  // Assainissement défensif : un record corrompu (édité à la main, crash
  // disque…) ne doit pas faire planter chaque lecture qui passe.
  const clean: Record<string, MediaMarkerRecord> = {};
  for (const [key, rec] of Object.entries(r.byRatingKey)) {
    if (!rec || typeof rec !== "object" || !Array.isArray(rec.markers)) continue;
    clean[key] = {
      ratingKey: typeof rec.ratingKey === "string" ? rec.ratingKey : key,
      markers: rec.markers.filter(
        (m) =>
          m &&
          typeof m.startMs === "number" &&
          typeof m.endMs === "number" &&
          Number.isFinite(m.startMs) &&
          Number.isFinite(m.endMs)
      ),
      signature: typeof rec.signature === "string" ? rec.signature : "",
      plexUpdatedAt: typeof rec.plexUpdatedAt === "number" ? rec.plexUpdatedAt : null,
      lastSyncedAt: typeof rec.lastSyncedAt === "number" ? rec.lastSyncedAt : 0,
    };
  }
  return { version: 1, byRatingKey: clean };
}
