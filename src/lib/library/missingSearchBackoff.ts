import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Per-title spacing for the scheduled « Relance des manquants » only — never
 * for a manual search, the RSS match or the release-day search. A title the
 * retry already searched without success waits 1 day, then 3 days (at most) before
 * the retry tries it again: an old missing title rarely appears overnight, and
 * the 15-minute RSS scan still grabs it the moment it shows up in a feed.
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "missing-search-backoff.json");
const DAY_MS = 24 * 60 * 60 * 1000;
// Capped at 3 days: an old title that appears outside every RSS feed must
// never wait a week.
export const BACKOFF_STEPS_MS = [DAY_MS, 3 * DAY_MS];

interface Entry { lastAt: number; attempts: number }
type Store = Record<string, Entry>;

function load(): Store {
  return readJsonCached<Store>(FILE, {});
}

export function backoffDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return BACKOFF_STEPS_MS[Math.min(attempts, BACKOFF_STEPS_MS.length) - 1];
}

/** True when the scheduled retry may search this key now. */
export function isDueForRetry(key: string, now = Date.now(), store: Store = load()): boolean {
  const entry = store[key];
  if (!entry) return true;
  return now - entry.lastAt >= backoffDelayMs(entry.attempts);
}

/**
 * Records one scheduled-retry pass. `stillMissing` lists the keys searched
 * this pass that are still missing afterwards (one more attempt each); keys
 * of the same kind (`prefix`) not in `activeKeys` (found, removed,
 * unmonitored) are dropped so a title that goes missing again later starts
 * over at the first step. Other kinds are left untouched.
 */
export function recordRetryPass(prefix: "movie:" | "series:", stillMissing: string[], activeKeys: Set<string>, now = Date.now()): void {
  const prev = load();
  const next: Store = {};
  for (const [key, entry] of Object.entries(prev)) {
    if (!key.startsWith(prefix) || activeKeys.has(key)) next[key] = entry;
  }
  for (const key of stillMissing) {
    next[key] = { lastAt: now, attempts: (prev[key]?.attempts ?? 0) + 1 };
  }
  writeJsonCached(FILE, next);
}
