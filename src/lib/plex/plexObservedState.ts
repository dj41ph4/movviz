import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached, jsonCacheReadFailed } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const FILE = path.join(CONFIG_DIR, "plex-observed-state.json");

export type ObservedWatchState = "WATCHED" | "UNWATCHED" | "UNKNOWN";
export type PlexObservedState = {
  userId: string;
  machineIdentifier: string;
  ratingKey: string;
  state: ObservedWatchState;
  viewCount?: number;
  lastViewedAt?: number; // epoch ms
  viewOffset?: number;
  observedAt: number;
};

type StoreShape = { version: 1; entries: PlexObservedState[] };

function keyOf(e: Pick<PlexObservedState, "userId" | "machineIdentifier" | "ratingKey">): string {
  return `${e.userId}::${e.machineIdentifier}::${e.ratingKey}`;
}

function readStore(): StoreShape {
  return readJsonCached<StoreShape>(FILE, { version: 1, entries: [] });
}

function writeStore(shape: StoreShape): boolean {
  if (jsonCacheReadFailed(FILE)) {
    console.error("[plexObservedState] refus d'écrire " + FILE + " : lecture précédente en échec");
    return false;
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
  return true;
}

// In-memory map for fast diff
const g = globalThis as typeof globalThis & {
  __movvizPlexObservedMap?: Map<string, PlexObservedState>;
};

function mem(): Map<string, PlexObservedState> {
  if (g.__movvizPlexObservedMap) return g.__movvizPlexObservedMap;
  const shape = readStore();
  const map = new Map<string, PlexObservedState>();
  for (const e of shape.entries) map.set(keyOf(e), e);
  g.__movvizPlexObservedMap = map;
  return map;
}

function persist(): void {
  const map = mem();
  const shape: StoreShape = { version: 1, entries: [...map.values()] };
  writeStore(shape);
}

export function getObservedState(userId: string, machineIdentifier: string, ratingKey: string): PlexObservedState | null {
  return mem().get(keyOf({ userId, machineIdentifier, ratingKey })) ?? null;
}

export function getObservedStatesForUser(userId: string, machineIdentifier: string): Map<string, PlexObservedState> {
  const out = new Map<string, PlexObservedState>();
  for (const [k, v] of mem()) {
    if (v.userId === userId && v.machineIdentifier === machineIdentifier) out.set(v.ratingKey, v);
  }
  return out;
}

export function getAllObservedStates(): PlexObservedState[] {
  return [...mem().values()];
}

export function setObservedStates(states: PlexObservedState[]): void {
  const map = mem();
  for (const s of states) map.set(keyOf(s), s);
  persist();
}

export function replaceObservedStatesForUserServer(userId: string, machineIdentifier: string, states: PlexObservedState[]): void {
  const map = mem();
  // Atomic replace per §29: delete old entries for this user/server, then insert new snapshot
  const toDelete: string[] = [];
  for (const [k, v] of map) {
    if (v.userId === userId && v.machineIdentifier === machineIdentifier) toDelete.push(k);
  }
  for (const k of toDelete) map.delete(k);
  for (const s of states) {
    // Ensure state belongs to this user/server (defensive)
    if (s.userId !== userId || s.machineIdentifier !== machineIdentifier) continue;
    map.set(keyOf(s), s);
  }
  persist();
}

export function upsertObservedState(state: PlexObservedState): void {
  mem().set(keyOf(state), state);
  persist();
}

export function removeObservedStatesForKeys(userId: string, machineIdentifier: string, ratingKeys: Set<string>): void {
  const map = mem();
  let changed = false;
  for (const rk of ratingKeys) {
    const k = keyOf({ userId, machineIdentifier, ratingKey: rk });
    if (map.delete(k)) changed = true;
  }
  if (changed) persist();
}

/** Snapshot key for cursor tracking */
export function observedStateVersion(): string {
  // Simple mtime-based version via file stat is handled by readJsonCached,
  // this is just for debugging.
  return String(mem().size);
}
