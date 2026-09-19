import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-circuit-breaker.json");

type Entry = { failureCount: number; nextRetryAt: number; lastError: string | null; lastFailureAt: number };
type Shape = Record<string, Entry>; // key = movvizUserId

const g = globalThis as typeof globalThis & { __movvizPlexCircuit?: Map<string, Entry> };

function mem(): Map<string, Entry> {
  if (g.__movvizPlexCircuit) return g.__movvizPlexCircuit;
  const raw = readJsonCached<Shape>(FILE, {});
  const map = new Map<string, Entry>(Object.entries(raw));
  g.__movvizPlexCircuit = map;
  return map;
}
function persist(): void {
  const shape: Shape = {};
  for (const [k, v] of mem()) shape[k] = v;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, shape);
}

const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 60 * 60 * 1000; // 1h
const FAILURE_THRESHOLD = 5;

export function recordCircuitFailure(userId: string, error: string): void {
  const m = mem();
  const prev = m.get(userId);
  const count = (prev?.failureCount ?? 0) + 1;
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, count - 1), MAX_DELAY_MS);
  m.set(userId, { failureCount: count, nextRetryAt: Date.now() + delay, lastError: error, lastFailureAt: Date.now() });
  persist();
}

export function recordCircuitSuccess(userId: string): void {
  const m = mem();
  if (m.has(userId)) {
    m.delete(userId);
    persist();
  }
}

export function isCircuitOpen(userId: string): boolean {
  const e = mem().get(userId);
  if (!e) return false;
  if (Date.now() >= e.nextRetryAt) return false; // allow retry
  return e.failureCount >= FAILURE_THRESHOLD;
}

export function getCircuitState(userId: string): Entry | null {
  return mem().get(userId) ?? null;
}

export function circuitDelayMs(userId: string): number {
  const e = mem().get(userId);
  if (!e) return 0;
  return Math.max(0, e.nextRetryAt - Date.now());
}
