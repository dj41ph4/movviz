import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-history-bootstrap.json");

export type PlexHistoryBootstrapState = {
  version: 2;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "ERROR";
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  processedEvents: number;
  resolvedEvents: number;
  unresolvedEvents: number;
  errorEvents: number;
  currentStart: number;
  expectedTotal: number | null;
  upperBoundViewedAt: number | null;
  error: string | null;
};

type Shape = Record<string, PlexHistoryBootstrapState>;

function key(userId: string, machineIdentifier: string): string {
  return `${userId}::${machineIdentifier}`;
}

function readRaw(): Record<string, unknown> {
  return readJsonCached<Record<string, unknown>>(FILE, {});
}

function migrateIfNeeded(raw: Record<string, unknown>): Shape {
  const out: Shape = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    // V2 is the only compatible shape: V1 currentStart indexed a local
    // deduplicated array, V2 indexes the Plex source directly.
    if (o.version === 2 && "status" in o) {
      out[k] = o as unknown as PlexHistoryBootstrapState;
      continue;
    }
    // V1 offsets are incompatible and are intentionally reset once.
    out[k] = {
      version: 2,
      status: "PENDING",
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
      processedEvents: 0,
      resolvedEvents: 0,
      unresolvedEvents: 0,
      errorEvents: 0,
      currentStart: 0,
      expectedTotal: null,
      upperBoundViewedAt: null,
      error: null,
    };
  }
  return out;
}

function readStore(): Shape {
  const raw = readRaw();
  const migrated = migrateIfNeeded(raw);
  // If migration happened, persist once
  const rawKeys = Object.keys(raw);
  const migratedKeys = Object.keys(migrated);
  if (rawKeys.length !== migratedKeys.length || rawKeys.some((k) => JSON.stringify(raw[k]) !== JSON.stringify(migrated[k]))) {
    // Only persist if shape changed and we have data
    if (migratedKeys.length > 0) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      writeJsonCached(FILE, migrated);
    }
  }
  return migrated;
}

function writeStore(shape: Shape): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
}

export function getBootstrapState(userId: string, machineIdentifier: string): PlexHistoryBootstrapState | null {
  return readStore()[key(userId, machineIdentifier)] ?? null;
}

export function isBootstrapCompleted(userId: string, machineIdentifier: string): boolean {
  return getBootstrapState(userId, machineIdentifier)?.status === "COMPLETED";
}

export function ensureBootstrapPending(userId: string, machineIdentifier: string): PlexHistoryBootstrapState {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  if (!shape[k]) {
    shape[k] = {
      version: 2,
      status: "PENDING",
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
      processedEvents: 0,
      resolvedEvents: 0,
      unresolvedEvents: 0,
      errorEvents: 0,
      currentStart: 0,
      expectedTotal: null,
      upperBoundViewedAt: null,
      error: null,
    };
    writeStore(shape);
  } else if (shape[k].status !== "COMPLETED" && shape[k].status !== "RUNNING") {
    // Keep PENDING as is, don't overwrite RUNNING
  }
  return shape[k];
}

export function startBootstrap(userId: string, machineIdentifier: string, totalEntries: number, upperBoundViewedAt: number | null): PlexHistoryBootstrapState {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const now = Date.now();
  shape[k] = {
    version: 2,
    status: "RUNNING",
    startedAt: shape[k]?.startedAt ?? now,
    completedAt: null,
    updatedAt: now,
    processedEvents: shape[k]?.processedEvents ?? 0,
    resolvedEvents: shape[k]?.resolvedEvents ?? 0,
    unresolvedEvents: shape[k]?.unresolvedEvents ?? 0,
    errorEvents: shape[k]?.errorEvents ?? 0,
    currentStart: shape[k]?.currentStart ?? 0,
    expectedTotal: totalEntries,
    upperBoundViewedAt,
    error: null,
  };
  // If this is a fresh start (previously PENDING with 0 processed), reset counters
  if (shape[k].processedEvents === 0 && shape[k].currentStart === 0) {
    shape[k].startedAt = now;
  }
  writeStore(shape);
  return shape[k];
}

export function updateBootstrapProgress(
  userId: string,
  machineIdentifier: string,
  processedEvents: number,
  resolvedEvents: number,
  unresolvedEvents: number,
  currentStart: number,
  errorEvents: number,
  expectedTotal: number | null
): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.processedEvents = processedEvents;
  cur.resolvedEvents = resolvedEvents;
  cur.unresolvedEvents = unresolvedEvents;
  cur.errorEvents = errorEvents;
  cur.currentStart = currentStart;
  cur.expectedTotal = expectedTotal;
  cur.updatedAt = Date.now();
  cur.status = "RUNNING";
  writeStore(shape);
}

export function completeBootstrap(userId: string, machineIdentifier: string): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.status = "COMPLETED";
  cur.completedAt = Date.now();
  cur.updatedAt = Date.now();
  writeStore(shape);
}

export function failBootstrap(userId: string, machineIdentifier: string, error: string): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.status = "ERROR";
  cur.error = error;
  cur.updatedAt = Date.now();
  writeStore(shape);
}

export function clearBootstrap(userId: string, machineIdentifier: string): void {
  const shape = readStore();
  delete shape[key(userId, machineIdentifier)];
  writeStore(shape);
}

export function resetBootstrapForUser(userId: string, machineIdentifier: string): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  shape[k] = {
    version: 2,
    status: "PENDING",
    startedAt: null,
    completedAt: null,
    updatedAt: Date.now(),
    processedEvents: 0,
    resolvedEvents: 0,
    unresolvedEvents: 0,
    errorEvents: 0,
    currentStart: 0,
    expectedTotal: null,
    upperBoundViewedAt: null,
    error: null,
  };
  writeStore(shape);
}

export function getAllBootstrapStates(): Record<string, PlexHistoryBootstrapState> {
  return readStore();
}

// Legacy aliases for existing callers (will be phased out)
export function getBootstrapStateLegacy(userId: string, machineIdentifier: string) {
  return getBootstrapState(userId, machineIdentifier);
}
