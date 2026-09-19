import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached, jsonCacheReadFailed } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-bindings.json");

// Type wrappers (§5) – distinct brand to prevent accidental exchange
export type MovvizUserId = string & { __brand: "MovvizUserId" };
export type PlexCloudAccountId = string & { __brand: "PlexCloudAccountId" };
export type PlexManagedUserId = string & { __brand: "PlexManagedUserId" };
export type PlexLocalAccountId = number & { __brand: "PlexLocalAccountId" };
export type PlexRatingKey = string & { __brand: "PlexRatingKey" };
export type PlexMachineIdentifier = string & { __brand: "PlexMachineIdentifier" };

export type BindingSource =
  | "OWNER_EXACT"
  | "HOME_EXACT"
  | "ACCOUNT_EXACT"
  | "MIGRATED_LEGACY"
  | "MANUAL_CONFIRMED";

export interface PlexAccountBinding {
  movvizUserId: string;
  plexAccountId?: string;
  plexManagedUserId?: string;
  machineIdentifier: string;
  localAccountId: number;
  localAccountName: string;
  bindingSource: BindingSource;
  verifiedAt: number;
  tokenFingerprint?: string;
}

type Shape = { version: 1; bindings: PlexAccountBinding[] };

function readStore(): Shape {
  return readJsonCached<Shape>(FILE, { version: 1, bindings: [] });
}
function writeStore(shape: Shape): boolean {
  if (jsonCacheReadFailed(FILE)) {
    console.error("[plexBindingStore] refus d'écrire " + FILE + " : lecture précédente en échec");
    return false;
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
  return true;
}

const g = globalThis as typeof globalThis & { __movvizPlexBindings?: Map<string, PlexAccountBinding> };
function mem(): Map<string, PlexAccountBinding> {
  if (g.__movvizPlexBindings) return g.__movvizPlexBindings;
  const shape = readStore();
  const map = new Map<string, PlexAccountBinding>();
  for (const b of shape.bindings) map.set(bindingKey(b.movvizUserId, b.machineIdentifier), b);
  g.__movvizPlexBindings = map;
  return map;
}
function bindingKey(movvizUserId: string, machineIdentifier: string): string {
  return `${movvizUserId}::${machineIdentifier}`;
}
function persist(): void {
  const shape: Shape = { version: 1, bindings: [...mem().values()] };
  writeStore(shape);
}

export function getBinding(movvizUserId: string, machineIdentifier: string): PlexAccountBinding | null {
  return mem().get(bindingKey(movvizUserId, machineIdentifier)) ?? null;
}

export function getBindingsForUser(movvizUserId: string): PlexAccountBinding[] {
  return [...mem().values()].filter((b) => b.movvizUserId === movvizUserId);
}

export function getAllBindings(): PlexAccountBinding[] {
  return [...mem().values()];
}

export function upsertBinding(binding: PlexAccountBinding): void {
  mem().set(bindingKey(binding.movvizUserId, binding.machineIdentifier), binding);
  persist();
}

export function removeBinding(movvizUserId: string, machineIdentifier: string): void {
  if (mem().delete(bindingKey(movvizUserId, machineIdentifier))) persist();
}

export function clearAllBindings(): void {
  mem().clear();
  persist();
}
