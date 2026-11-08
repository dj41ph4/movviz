import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { markerSourcePriority, markerTypePriority } from "@/lib/settings/markerSources";
import { mergeMarkers } from "./merge";
import {
  emptyPlaybackMarkerStore,
  migrateMarkerStore,
  type MarkerSourceState,
  type MediaMarkerRecord,
  type PlaybackMarker,
  type PlaybackMarkerSource,
  type PlaybackMarkerStore,
} from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "playback-markers.json");

/** Store process-wide (Next.js bundle chaque route séparément — ancrage
 *  globalThis obligatoire, même convention que le reste de Movviz). */
const g = globalThis as typeof globalThis & { __movvizMarkerStore?: PlaybackMarkerStore };

function store(): PlaybackMarkerStore {
  if (!g.__movvizMarkerStore) {
    const raw = readJsonCached<unknown>(FILE, {});
    g.__movvizMarkerStore = migrateMarkerStore(raw);
    // Fichier v1 : le migré n'est écrit qu'à la première écriture réelle
    // (persist), jamais à la lecture — un rollback d'appli relit l'ancien.
  }
  return g.__movvizMarkerStore;
}

function persist() {
  writeJsonCached(FILE, g.__movvizMarkerStore ?? emptyPlaybackMarkerStore());
}

/** Marqueurs à jouer pour un média, toutes sources fusionnées (voir
 *  merge.ts). `keys` = toutes les clés sous lesquelles le média peut être
 *  connu : ratingKey Plex et/ou identifiant Movviz. Vide ou inconnu → []. */
export function getPlaybackMarkers(...keys: (string | null | undefined)[]): PlaybackMarker[] {
  const all: PlaybackMarker[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const rec = store().byKey[key];
    if (rec) all.push(...rec.markers);
  }
  // Réglage Paramètres → Métadonnées : « Plex uniquement » masque les autres
  // sources sans les effacer (le choix reste réversible).
  return mergeMarkers(all, markerSourcePriority(), markerTypePriority());
}

export function getMarkerRecord(key: string): MediaMarkerRecord | null {
  return store().byKey[key] ?? null;
}

export function getSourceState(key: string, source: PlaybackMarkerSource): MarkerSourceState | null {
  return store().byKey[key]?.sources[source] ?? null;
}

/** Marqueurs d'UNE seule source (jamais fusionnés) — pour la sync de cette
 *  source, qui compare avec ce qu'elle avait écrit elle-même. */
export function getSourceMarkers(key: string, source: PlaybackMarkerSource): PlaybackMarker[] {
  return store().byKey[key]?.markers.filter((m) => m.source === source) ?? [];
}

/** Remplace UNIQUEMENT les marqueurs de `source` pour cette clé ; ceux des
 *  autres sources sont intacts (une sync Plex à zéro marqueur n'efface jamais
 *  ce qu'une autre source a trouvé). `markers` ne contient que des marqueurs
 *  de cette source. */
export function replaceSourceMarkers(
  key: string,
  source: PlaybackMarkerSource,
  markers: PlaybackMarker[],
  state: MarkerSourceState,
) {
  const s = store();
  const prev = s.byKey[key];
  const others = prev ? prev.markers.filter((m) => m.source !== source) : [];
  s.byKey[key] = {
    key,
    markers: [...others, ...markers].sort((a, b) => a.startMs - b.startMs),
    sources: { ...(prev?.sources ?? {}), [source]: state },
  };
  persist();
}

/** Rafraîchit le tick de sync d'une source sans réécrire ses marqueurs. */
export function touchSourceSync(key: string, source: PlaybackMarkerSource, at: number) {
  const st = store().byKey[key]?.sources[source];
  if (!st) return;
  st.lastSyncedAt = at;
  persist();
}

/** Retire les marqueurs ET l'état d'une source ; l'enregistrement disparaît
 *  si plus aucune source n'y est présente. */
export function removeSourceMarkers(key: string, source: PlaybackMarkerSource) {
  const s = store();
  const rec = s.byKey[key];
  if (!rec) return;
  delete rec.sources[source];
  rec.markers = rec.markers.filter((m) => m.source !== source);
  if (Object.keys(rec.sources).length === 0 && rec.markers.length === 0) delete s.byKey[key];
  persist();
}

/** Clés pour lesquelles `source` a déjà répondu (même à zéro marqueur). */
export function getKeysWithSource(source: PlaybackMarkerSource): string[] {
  return Object.entries(store().byKey)
    .filter(([, rec]) => rec.sources[source])
    .map(([key]) => key);
}

/** Stats agrégées pour la page Réglages — calculées à la volée depuis le
 *  store, aucune persistence dédiée (même convention que le reste de
 *  l'app : pas de second système juste pour des chiffres). Comptage limité
 *  à la source Plex : cette page est celle de la synchro Plex. */
export function markerStats(): { mediaWithMarkers: number; intros: number; credits: number } {
  let mediaWithMarkers = 0;
  let intros = 0;
  let credits = 0;
  for (const rec of Object.values(store().byKey)) {
    const plex = rec.markers.filter((m) => m.source === "plex");
    if (plex.length === 0) continue;
    mediaWithMarkers += 1;
    for (const m of plex) {
      if (m.type === "intro") intros += 1;
      else if (m.type === "credits") credits += 1;
    }
  }
  return { mediaWithMarkers, intros, credits };
}
