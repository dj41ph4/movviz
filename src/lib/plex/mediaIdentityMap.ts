import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached, jsonCacheReadFailed } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const FILE = path.join(CONFIG_DIR, "plex-media-identity-map.json");

export type CanonicalMediaIdentity =
  | { type: "movie"; tmdbId: number }
  | { type: "episode"; tmdbShowId: number; seasonNumber: number; episodeNumber: number };

export type MediaIdentityEntry = {
  machineIdentifier: string;
  ratingKey: string;
  canonical: CanonicalMediaIdentity;
  title?: string;
  updatedAt: number;
};

type StoreShape = { version: 1; entries: MediaIdentityEntry[] };

function mapKey(machineIdentifier: string, ratingKey: string): string {
  return `${machineIdentifier}::${ratingKey}`;
}

function canonicalKey(c: CanonicalMediaIdentity): string {
  return c.type === "movie" ? `movie:${c.tmdbId}` : `episode:${c.tmdbShowId}:${c.seasonNumber}:${c.episodeNumber}`;
}

function readStore(): StoreShape {
  return readJsonCached<StoreShape>(FILE, { version: 1, entries: [] });
}

function writeStore(shape: StoreShape): boolean {
  if (jsonCacheReadFailed(FILE)) {
    console.error("[mediaIdentityMap] refus d'écrire " + FILE + " : lecture précédente en échec");
    return false;
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
  return true;
}

const g = globalThis as typeof globalThis & {
  __movvizMediaIdentityMap?: Map<string, MediaIdentityEntry>;
  __movvizMediaIdentityReverse?: Map<string, MediaIdentityEntry>;
};

function memForward(): Map<string, MediaIdentityEntry> {
  if (g.__movvizMediaIdentityMap) return g.__movvizMediaIdentityMap;
  const shape = readStore();
  const map = new Map<string, MediaIdentityEntry>();
  for (const e of shape.entries) map.set(mapKey(e.machineIdentifier, e.ratingKey), e);
  g.__movvizMediaIdentityMap = map;
  return map;
}

function memReverse(): Map<string, MediaIdentityEntry> {
  if (g.__movvizMediaIdentityReverse) return g.__movvizMediaIdentityReverse;
  const fwd = memForward();
  const rev = new Map<string, MediaIdentityEntry>();
  for (const e of fwd.values()) rev.set(canonicalKey(e.canonical), e);
  g.__movvizMediaIdentityReverse = rev;
  return rev;
}

function persist(): void {
  const shape: StoreShape = { version: 1, entries: [...memForward().values()] };
  writeStore(shape);
}

export function resolveCanonical(machineIdentifier: string, ratingKey: string): CanonicalMediaIdentity | null {
  return memForward().get(mapKey(machineIdentifier, ratingKey))?.canonical ?? null;
}

export function resolveRatingKey(machineIdentifier: string, canonical: CanonicalMediaIdentity): string | null {
  // Note: reverse map is per-machine but canonicalKey alone may collide across machines.
  // We scan forward map for exact machine match.
  for (const e of memForward().values()) {
    if (e.machineIdentifier !== machineIdentifier) continue;
    if (e.canonical.type !== canonical.type) continue;
    if (canonical.type === "movie" && e.canonical.type === "movie" && e.canonical.tmdbId === canonical.tmdbId) return e.ratingKey;
    if (canonical.type === "episode" && e.canonical.type === "episode" && e.canonical.tmdbShowId === (canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).tmdbShowId && e.canonical.seasonNumber === (canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).seasonNumber && e.canonical.episodeNumber === (canonical as Extract<CanonicalMediaIdentity, { type: "episode" }>).episodeNumber) return e.ratingKey;
  }
  return null;
}

export function upsertMapping(entry: MediaIdentityEntry): void {
  const k = mapKey(entry.machineIdentifier, entry.ratingKey);
  memForward().set(k, entry);
  // Invalidate reverse
  g.__movvizMediaIdentityReverse = undefined;
  persist();
}

export function upsertMappings(entries: MediaIdentityEntry[]): void {
  if (entries.length === 0) return;
  const fwd = memForward();
  for (const e of entries) fwd.set(mapKey(e.machineIdentifier, e.ratingKey), e);
  g.__movvizMediaIdentityReverse = undefined;
  persist();
}

export function removeMappingsForMachine(machineIdentifier: string, ratingKeys: string[]): void {
  const fwd = memForward();
  let changed = false;
  for (const rk of ratingKeys) {
    if (fwd.delete(mapKey(machineIdentifier, rk))) changed = true;
  }
  if (changed) {
    g.__movvizMediaIdentityReverse = undefined;
    persist();
  }
}

export function getMappingsForMachine(machineIdentifier: string): MediaIdentityEntry[] {
  return [...memForward().values()].filter((e) => e.machineIdentifier === machineIdentifier);
}

export function clearAllMappings(): void {
  memForward().clear();
  g.__movvizMediaIdentityReverse = undefined;
  persist();
}
