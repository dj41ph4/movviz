import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-sync-state.json");

interface SyncState {
  moviesLastSyncedAt: number; // unix seconds
  seriesLastSyncedAt: number;
}

const DEFAULT: SyncState = { moviesLastSyncedAt: 0, seriesLastSyncedAt: 0 };

export function loadSyncState(): SyncState {
  return { ...DEFAULT, ...readJsonCached<Partial<SyncState>>(FILE, {}) };
}

export function saveSyncState(state: SyncState) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, state);
}

/** Danger zone: forget the last sync watermark so the next Plex sync (scheduled or manual) re-scans everything. */
export function resetSyncState() {
  saveSyncState({ ...DEFAULT });
}
