import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import {
  emptyPlaybackMarkerStore,
  migrateMarkerStore,
  type MediaMarkerRecord,
  type PlaybackMarker,
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
  }
  return g.__movvizMarkerStore;
}

function persist() {
  writeJsonCached(FILE, g.__movvizMarkerStore ?? emptyPlaybackMarkerStore());
}

export function getPlaybackMarkers(ratingKey: string): PlaybackMarker[] {
  return store().byRatingKey[ratingKey]?.markers ?? [];
}

export function getMarkerRecord(ratingKey: string): MediaMarkerRecord | null {
  return store().byRatingKey[ratingKey] ?? null;
}

export function upsertMarkerRecord(record: MediaMarkerRecord) {
  store().byRatingKey[record.ratingKey] = record;
  persist();
}

export function removeMarkerRecord(ratingKey: string) {
  delete store().byRatingKey[ratingKey];
  persist();
}

export function getAllMarkerRatingKeys(): string[] {
  return Object.keys(store().byRatingKey);
}

/** Stats agrégées pour la page Réglages — calculées à la volée depuis le
 *  store, aucune persistence dédiée (même convention que le reste de
 *  l'app : pas de second système juste pour des chiffres). */
export function markerStats(): { mediaWithMarkers: number; intros: number; credits: number } {
  let mediaWithMarkers = 0;
  let intros = 0;
  let credits = 0;
  for (const rec of Object.values(store().byRatingKey)) {
    if (rec.markers.length === 0) continue;
    mediaWithMarkers += 1;
    for (const m of rec.markers) {
      if (m.type === "intro") intros += 1;
      else if (m.type === "credits") credits += 1;
    }
  }
  return { mediaWithMarkers, intros, credits };
}
