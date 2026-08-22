/**
 * État de synchronisation des markers Plex — SÉPARÉ du store playback :
 * ce fichier ne sert qu'au moteur (dirty, retries, bucket d'audit), jamais
 * à la lecture. Un store de playback propre ne doit pas connaître la
 * mécanique scheduler.
 */
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-marker-sync-state.json");

export type DirtyReason = "new" | "updated" | "file_changed";

export interface PlexMarkerSyncState {
  lastIncrementalAt: number | null;
  lastFullAt: number | null;
  /** updatedAt (unix sec) vu par le signal venu de librarySync — permet de
   *  distinguer new/updated sans re-scanner Plex. */
  knownUpdatedAt: Record<string, number>;
  /** ratingKeys en attente de fetch markers. */
  dirty: Record<string, { plexUpdatedAt: number; reason: DirtyReason }>;
  /** Médias synchronisés avec 0 marker — retry quotidien ~7 passages,
   *  ensuite l'audit tournant hebdomadaire reste leur filet. */
  emptyRetry: Record<string, { attempts: number; nextRetryAt: number }>;
  /** Bucket d'audit courant (0..6) — avance d'un cran par jour. */
  auditBucket: number;
}

const g = globalThis as typeof globalThis & { __movvizMarkerSyncState?: PlexMarkerSyncState };

function blank(): PlexMarkerSyncState {
  return { lastIncrementalAt: null, lastFullAt: null, knownUpdatedAt: {}, dirty: {}, emptyRetry: {}, auditBucket: 0 };
}

export function loadMarkerSyncState(): PlexMarkerSyncState {
  if (!g.__movvizMarkerSyncState) {
    const raw = readJsonCached<Partial<PlexMarkerSyncState>>(FILE, {});
    g.__movvizMarkerSyncState = {
      lastIncrementalAt: typeof raw.lastIncrementalAt === "number" ? raw.lastIncrementalAt : null,
      lastFullAt: typeof raw.lastFullAt === "number" ? raw.lastFullAt : null,
      knownUpdatedAt: raw.knownUpdatedAt ?? {},
      dirty: raw.dirty ?? {},
      emptyRetry: raw.emptyRetry ?? {},
      auditBucket: typeof raw.auditBucket === "number" ? raw.auditBucket : 0,
    };
  }
  return g.__movvizMarkerSyncState;
}

export function saveMarkerSyncState(state: PlexMarkerSyncState) {
  g.__movvizMarkerSyncState = state;
  writeJsonCached(FILE, state);
}
