/**
 * Marqueurs de navigation temporelle génériques (récap, intro, générique,
 * avant-première) — couche au-dessus du playback existant, jamais un
 * pipeline vidéo.
 *
 * Le modèle est VOLONTAIREMENT neutre : Plex (analyse intro/credits du
 * serveur) est la source principale, mais une autre source (chapitres du
 * fichier, TheIntroDB, saisie manuelle…) alimente le MÊME store, dans le
 * MÊME format, sans toucher ni l'API ni les clients. Chaque marqueur porte
 * sa source ; chaque source ne remplace que ses propres marqueurs ; la
 * fusion (merge.ts) se fait à la lecture.
 */

export type PlaybackMarkerType = "recap" | "intro" | "credits" | "preview";

export const PLAYBACK_MARKER_TYPES: readonly PlaybackMarkerType[] = ["recap", "intro", "credits", "preview"];

/** Sources connues, de la plus prioritaire à la moins prioritaire. */
export type PlaybackMarkerSource = "plex" | "theintrodb";

export const PLAYBACK_MARKER_SOURCES: readonly PlaybackMarkerSource[] = ["plex", "theintrodb"];

export interface PlaybackMarker {
  id: string;
  source: PlaybackMarkerSource;
  /** Id du marker côté source, conservé à titre informatif/diagnostic. */
  sourceMarkerId: string | null;
  type: PlaybackMarkerType;
  startMs: number;
  endMs: number;
  final: boolean;
}

/** État de synchronisation d'UNE source pour un média : permet de comparer
 *  sans réécrire si identique, et de savoir qu'une source a déjà répondu
 *  (même avec zéro marqueur). */
export interface MarkerSourceState {
  /** Empreinte déterministe des marqueurs de cette source. */
  signature: string;
  /** updatedAt côté source vu lors de la dernière sync réussie (Plex : unix sec). */
  sourceUpdatedAt: number | null;
  lastSyncedAt: number;
}

/** Un enregistrement par clé de média — lookup O(1), écriture isolée de la
 *  bibliothèque (les markers ont leur propre cycle de synchronisation et
 *  library-series.json peut être énorme : ne jamais y ranger ces données).
 *
 *  La clé est celle de la source : le ratingKey Plex pour la sync Plex,
 *  l'identifiant Movviz du média pour les sources sans Plex. La lecture
 *  fusionne les enregistrements de toutes les clés connues du média. */
export interface MediaMarkerRecord {
  key: string;
  /** Marqueurs de TOUTES les sources, triés par startMs. */
  markers: PlaybackMarker[];
  sources: Partial<Record<PlaybackMarkerSource, MarkerSourceState>>;
}

export interface PlaybackMarkerStore {
  version: 2;
  byKey: Record<string, MediaMarkerRecord>;
}

export function emptyPlaybackMarkerStore(): PlaybackMarkerStore {
  return { version: 2, byKey: {} };
}

function isSource(v: unknown): v is PlaybackMarkerSource {
  return typeof v === "string" && (PLAYBACK_MARKER_SOURCES as readonly string[]).includes(v);
}

function isType(v: unknown): v is PlaybackMarkerType {
  return typeof v === "string" && (PLAYBACK_MARKER_TYPES as readonly string[]).includes(v);
}

/** Assainissement défensif d'un marqueur stocké : un enregistrement corrompu
 *  (édité à la main, crash disque…) ne doit pas faire planter chaque lecture
 *  qui passe. Les marqueurs v1 n'avaient que "intro" | "credits" et la source
 *  "plex" — `fallbackSource` la leur restitue. */
function cleanMarker(m: unknown, fallbackSource: PlaybackMarkerSource | null): PlaybackMarker | null {
  if (!m || typeof m !== "object") return null;
  const r = m as Partial<PlaybackMarker>;
  if (typeof r.startMs !== "number" || typeof r.endMs !== "number") return null;
  if (!Number.isFinite(r.startMs) || !Number.isFinite(r.endMs)) return null;
  if (!isType(r.type)) return null;
  const source = isSource(r.source) ? r.source : fallbackSource;
  if (!source) return null;
  return {
    id: typeof r.id === "string" ? r.id : `${r.type}-${Math.round(r.startMs)}-${Math.round(r.endMs)}`,
    source,
    sourceMarkerId: typeof r.sourceMarkerId === "string" ? r.sourceMarkerId : null,
    type: r.type,
    startMs: r.startMs,
    endMs: r.endMs,
    final: Boolean(r.final),
  };
}

function cleanSourceState(s: unknown): MarkerSourceState | null {
  if (!s || typeof s !== "object") return null;
  const r = s as Partial<MarkerSourceState>;
  return {
    signature: typeof r.signature === "string" ? r.signature : "",
    sourceUpdatedAt: typeof r.sourceUpdatedAt === "number" ? r.sourceUpdatedAt : null,
    lastSyncedAt: typeof r.lastSyncedAt === "number" ? r.lastSyncedAt : 0,
  };
}

/**
 * Migration v1 → v2 (clé par ratingKey, une seule source implicite "plex",
 * signature au niveau de l'enregistrement) puis assainissement v2. Une
 * lecture d'un fichier déjà v2 ne modifie rien.
 */
export function migrateMarkerStore(raw: unknown): PlaybackMarkerStore {
  if (!raw || typeof raw !== "object") return emptyPlaybackMarkerStore();
  const r = raw as { version?: unknown; byRatingKey?: unknown; byKey?: unknown };
  const clean: Record<string, MediaMarkerRecord> = {};

  if (r.version === 1 && r.byRatingKey && typeof r.byRatingKey === "object") {
    for (const [key, rec] of Object.entries(r.byRatingKey as Record<string, unknown>)) {
      if (!rec || typeof rec !== "object") continue;
      const v1 = rec as { ratingKey?: unknown; markers?: unknown; signature?: unknown; plexUpdatedAt?: unknown; lastSyncedAt?: unknown };
      if (!Array.isArray(v1.markers)) continue;
      const markers = v1.markers
        .map((m) => cleanMarker(m, "plex"))
        .filter((m): m is PlaybackMarker => m !== null)
        .sort((a, b) => a.startMs - b.startMs);
      clean[key] = {
        key: typeof v1.ratingKey === "string" ? v1.ratingKey : key,
        markers,
        sources: {
          plex: {
            signature: typeof v1.signature === "string" ? v1.signature : "",
            sourceUpdatedAt: typeof v1.plexUpdatedAt === "number" ? v1.plexUpdatedAt : null,
            lastSyncedAt: typeof v1.lastSyncedAt === "number" ? v1.lastSyncedAt : 0,
          },
        },
      };
    }
    return { version: 2, byKey: clean };
  }

  if (r.version === 2 && r.byKey && typeof r.byKey === "object") {
    for (const [key, rec] of Object.entries(r.byKey as Record<string, unknown>)) {
      if (!rec || typeof rec !== "object") continue;
      const v2 = rec as { key?: unknown; markers?: unknown; sources?: unknown };
      if (!Array.isArray(v2.markers)) continue;
      const markers = v2.markers
        .map((m) => cleanMarker(m, null))
        .filter((m): m is PlaybackMarker => m !== null)
        .sort((a, b) => a.startMs - b.startMs);
      const sources: MediaMarkerRecord["sources"] = {};
      if (v2.sources && typeof v2.sources === "object") {
        for (const [name, st] of Object.entries(v2.sources as Record<string, unknown>)) {
          if (!isSource(name)) continue;
          const state = cleanSourceState(st);
          if (state) sources[name] = state;
        }
      }
      clean[key] = { key: typeof v2.key === "string" ? v2.key : key, markers, sources };
    }
    return { version: 2, byKey: clean };
  }

  return emptyPlaybackMarkerStore();
}
