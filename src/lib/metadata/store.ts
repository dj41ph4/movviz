import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "tmdb.json");

function log(...args: unknown[]) {
  console.log("[tmdb-store]", ...args);
}

// tmdbGet() reads the key on every call, including cache hits — under bursty
// call volume (retry loops, polling) that turned into thousands of log lines
// and disk reads per minute and drove an OOM. Memoize briefly so repeated
// calls in the same burst are free.
const KEY_CACHE_TTL_MS = 10_000;
const gKeyCache = globalThis as typeof globalThis & {
  __movvizTmdbKeyCache?: { value: string | null; loadedAt: number };
};

export function loadTmdbKey(): string | null {
  const cached = gKeyCache.__movvizTmdbKeyCache;
  if (cached && Date.now() - cached.loadedAt < KEY_CACHE_TTL_MS) return cached.value;

  const exists = fs.existsSync(FILE);
  const val = exists ? readJsonCached<{ apiKey?: string }>(FILE, {}).apiKey || null : null;
  gKeyCache.__movvizTmdbKeyCache = { value: val, loadedAt: Date.now() };
  return val;
}

export function saveTmdbKey(apiKey: string) {
  log("save — key=" + "***" + apiKey.slice(-4));
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, { apiKey });
  gKeyCache.__movvizTmdbKeyCache = undefined;
}

/** Drops the stored custom key — falls back to the bundled default key (or MOVVIZ_TMDB_API_KEY) on next read. */
export function clearTmdbKey() {
  log("clear");
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, {});
  gKeyCache.__movvizTmdbKeyCache = undefined;
}
