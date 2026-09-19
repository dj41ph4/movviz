import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-history-bootstrap.json");

type BootstrapState = {
  completed: boolean;
  inProgress: boolean;
  cursorPageStart: number; // index of next entry to process
  lastViewedAt: number;
  totalEntries: number;
  processedCount: number;
  updatedAt: number;
  lastError?: string | null;
};

type Shape = Record<string, BootstrapState>; // key = userId::machineIdentifier

function key(userId: string, machineIdentifier: string): string {
  return `${userId}::${machineIdentifier}`;
}

function readStore(): Shape {
  return readJsonCached<Shape>(FILE, {});
}
function writeStore(shape: Shape): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
}

export function getBootstrapState(userId: string, machineIdentifier: string): BootstrapState | null {
  return readStore()[key(userId, machineIdentifier)] ?? null;
}

export function isBootstrapCompleted(userId: string, machineIdentifier: string): boolean {
  return getBootstrapState(userId, machineIdentifier)?.completed ?? false;
}

export function startBootstrap(userId: string, machineIdentifier: string, totalEntries: number): BootstrapState {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const state: BootstrapState = {
    completed: false,
    inProgress: true,
    cursorPageStart: 0,
    lastViewedAt: 0,
    totalEntries,
    processedCount: 0,
    updatedAt: Date.now(),
    lastError: null,
  };
  shape[k] = state;
  writeStore(shape);
  return state;
}

export function updateBootstrapProgress(userId: string, machineIdentifier: string, processedCount: number, lastViewedAt: number, cursorPageStart: number): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.processedCount = processedCount;
  cur.cursorPageStart = cursorPageStart;
  cur.lastViewedAt = Math.max(cur.lastViewedAt, lastViewedAt);
  cur.updatedAt = Date.now();
  cur.inProgress = true;
  writeStore(shape);
}

export function completeBootstrap(userId: string, machineIdentifier: string): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.completed = true;
  cur.inProgress = false;
  cur.updatedAt = Date.now();
  writeStore(shape);
}

export function failBootstrap(userId: string, machineIdentifier: string, error: string): void {
  const shape = readStore();
  const k = key(userId, machineIdentifier);
  const cur = shape[k];
  if (!cur) return;
  cur.inProgress = false;
  cur.lastError = error;
  cur.updatedAt = Date.now();
  writeStore(shape);
}

export function clearBootstrap(userId: string, machineIdentifier: string): void {
  const shape = readStore();
  delete shape[key(userId, machineIdentifier)];
  writeStore(shape);
}

export function resetBootstrapForUser(userId: string, machineIdentifier: string): void {
  clearBootstrap(userId, machineIdentifier);
}
