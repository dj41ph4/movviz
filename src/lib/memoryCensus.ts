import v8 from "node:v8";

/**
 * What is growing in memory? The heap total alone (870 Mo after a restart,
 * 1.4 Go five hours later on 2026-11-15, the server crawling by then) cannot
 * say. Every long-lived structure of Movviz is anchored on globalThis under
 * a `__movviz…` name, so counting their entries — a few microseconds, no
 * deep walk — and keeping one sample every 30 minutes shows which one keeps
 * growing between two readings of /api/perf.
 */
export interface MemoryCensusSample {
  t: number;
  heapUsedMb: number;
  /** Entry count of each Map / Set / Array holding at least MIN_ENTRIES. */
  sizes: Record<string, number>;
}

const MIN_ENTRIES = 200;
const SAMPLE_EVERY_MS = 30 * 60 * 1000;
const MAX_SAMPLES = 48; // one day

const g = globalThis as typeof globalThis & {
  __movvizMemoryCensus?: MemoryCensusSample[];
  __movvizMemoryCensusTimer?: ReturnType<typeof setInterval>;
};

function entryCount(value: unknown): number | null {
  if (value instanceof Map || value instanceof Set) return value.size;
  if (Array.isArray(value)) return value.length;
  return null;
}

export function takeMemoryCensus(): MemoryCensusSample {
  const sizes: Record<string, number> = {};
  for (const key of Object.keys(globalThis)) {
    if (!key.startsWith("__movviz")) continue;
    const value = (globalThis as Record<string, unknown>)[key];
    const own = entryCount(value);
    if (own != null) {
      if (own >= MIN_ENTRIES) sizes[key] = own;
      continue;
    }
    // One level down: several modules keep their Maps inside a state object.
    if (value && typeof value === "object") {
      for (const [inner, v] of Object.entries(value as Record<string, unknown>)) {
        const n = entryCount(v);
        if (n != null && n >= MIN_ENTRIES) sizes[`${key}.${inner}`] = n;
      }
    }
  }
  return { t: Date.now(), heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), sizes };
}

/** Starts the half-hourly sampling (idempotent; never keeps the process alive). */
export function startMemoryCensus(): void {
  if (g.__movvizMemoryCensusTimer) return;
  const history = (g.__movvizMemoryCensus ??= []);
  const sample = () => {
    history.push(takeMemoryCensus());
    if (history.length > MAX_SAMPLES) history.splice(0, history.length - MAX_SAMPLES);
  };
  g.__movvizMemoryCensusTimer = setInterval(sample, SAMPLE_EVERY_MS);
  g.__movvizMemoryCensusTimer.unref?.();
}

export function getMemoryCensus(): { heapLimitMb: number; now: MemoryCensusSample; history: MemoryCensusSample[] } {
  return {
    heapLimitMb: Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024),
    now: takeMemoryCensus(),
    history: g.__movvizMemoryCensus ?? [],
  };
}
