import fs from "node:fs";
import path from "node:path";

/**
 * Small in-memory TTL cache with real hit/miss accounting, used to avoid
 * hammering external APIs (TMDb today) on every request. Named instances are
 * tracked in a registry so an admin panel can inspect and clear them.
 *
 * A cache can optionally persist to disk (see `persistFile`): entries survive
 * a restart, and `getStale` keeps serving them (refreshing in the background)
 * even long past their TTL — so once a title has been fetched once, it never
 * has to hit the upstream API cold again, and a deliberate "fill the cache"
 * pass (see /api/cache/warm) makes every subsequent page load instant.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
  /**
   * Approximate JSON size of `value`, measured lazily by stats() and
   * memoized here (see measureEntries below). Absent until it has been
   * measured, and on entries loaded from a persist file written before this
   * field existed.
   *
   * History, because both extremes were wrong: stats() originally
   * re-serialized every cached value on each call, which with a full cache
   * meant megabytes of stringify per poll of the cache panel (it polls every
   * few seconds) on the main thread. Moving it to set() fixed that but paid
   * a full JSON.stringify of every TMDb response purely for a display
   * statistic — on the hot path, allocating a throwaway string per cached
   * response for the whole of a library warm. Lazy + bounded + memoized
   * costs nothing on set(), nothing on a converged panel poll, and a
   * capped slice of work on the polls in between.
   */
  sizeBytes?: number;
}

/**
 * Byte size `value` WOULD have as JSON, without building the JSON string.
 * Same order of CPU as JSON.stringify().length but allocation-free, which is
 * the point: the values here are whole TMDb responses, and materializing one
 * throwaway string per measurement is exactly the kind of multi-hundred-KB
 * transient allocation that drives this process's RSS up.
 *
 * Approximate on purpose — numbers are counted at a flat width rather than
 * formatted. The panel displays a human-readable MB figure, so being off by
 * a few percent on a 40 MB total is invisible, and it never justifies the
 * allocation that exactness would cost.
 *
 * `depth` is a hard safety stop, not a tuning knob. JSON.stringify (which
 * this replaced) throws on a circular structure, and the old call site
 * caught that and scored the entry 0; a plain recursive walk would instead
 * recurse forever and take the whole process down with a stack overflow.
 * Every value cached here is a parsed API response today — acyclic by
 * construction — so this ceiling should never actually be reached, which is
 * exactly why it must not be able to crash anything if one ever is.
 */
const MAX_MEASURE_DEPTH = 64;

function approxJsonSize(value: unknown, depth = 0): number {
  if (value === null || value === undefined) return 4; // "null"
  switch (typeof value) {
    case "boolean":
      return value ? 4 : 5;
    case "number":
      return 8;
    case "string":
      return value.length + 2; // quotes; ignores escaping
    case "object":
      break;
    default:
      return 0; // function/symbol — not serializable, contributes nothing
  }
  if (depth >= MAX_MEASURE_DEPTH) return 0;
  if (Array.isArray(value)) {
    let total = 2; // []
    for (const item of value) total += approxJsonSize(item, depth + 1) + 1; // + comma
    return total;
  }
  let total = 2; // {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    total += k.length + 4 + approxJsonSize(v, depth + 1); // "key": + comma
  }
  return total;
}

/**
 * How many not-yet-measured entries one stats() call is allowed to measure.
 * The panel polls, so a cache loaded cold from disk converges to exact over
 * a handful of polls instead of stalling the first one — and once converged,
 * every later poll only sums memoized numbers.
 */
const MEASURE_BUDGET_PER_STATS_CALL = 2000;

// Unbounded before this — a bulk operation touching thousands of distinct
// URLs (e.g. scanning a whole library for the first time) kept every
// response in memory forever, since eviction only ever happened lazily on a
// read of that exact expired key. That grew until the process ran out of
// heap. Map preserves insertion order, so capping here just means "evict the
// oldest entry" — an approximation of LRU that's good enough for an API
// Generic caches should remain modest. The TMDb metadata cache gets an
// explicit larger limit at creation: one library item naturally creates
// several distinct detail/image/search responses, so 3,500 caused useful
// entries to be evicted while the library was still being warmed.
const DEFAULT_MAX_ENTRIES = 3500;

// The persist file is only a warm-start optimization: losing its tail on a
// crash costs one extra upstream fetch per lost entry, nothing more. It was
// 2 s before, which during any metadata-heavy stretch (Discover browsing, a
// library scan) meant re-writing the whole ~12 MB file every couple of
// seconds — and synchronously, which froze the entire process for as long
// as the NAS disk (often busy seeding/downloading at the same time) took to
// swallow it: app unresponsive, CPU idle, API calls timing out.
const SAVE_DEBOUNCE_MS = 30_000;
/** Chars serialized between two awaited writes in writeStreamed(). */
const WRITE_CHUNK_CHARS = 1 << 20;

class NamedCache {
  private store = new Map<string, Entry<unknown>>();
  hits = 0;
  misses = 0;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastDiagAt = 0;
  /** Semaphore: true while a disk write is in flight. Max 1 at any time. */
  private writeInFlight = false;
  /** Set when the store changed during an in-flight write — one more pass follows it. */
  private pendingWrite = false;

  constructor(
    public readonly name: string,
    private ttlMs: number,
    private persistFile?: string,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES
  ) {
    if (persistFile) this.loadFromDisk();
  }

  private loadFromDisk() {
    if (!this.persistFile) return;
    try {
      const raw = fs.readFileSync(this.persistFile, "utf8");
      const data = JSON.parse(raw) as Record<string, Entry<unknown>>;
      for (const [k, v] of Object.entries(data)) this.store.set(k, v);
    } catch {
      // No cache file yet, or corrupt — start empty, harmless.
    }
  }

  /**
   * Async + atomic (temp file, then rename) — this was a synchronous
   * writeFileSync straight onto the final file before, which both blocked
   * the whole event loop for the duration of a multi-MB write (the "app
   * frozen with an idle CPU, every API call timing out" symptom on the NAS)
   * and could leave a truncated file behind on a crash mid-write.
   *
   * Serialized entry by entry and flushed in ~1 MB chunks, each write
   * yielding back to the event loop: the TMDb cache reached ~360 MB of JSON
   * in production, and a single JSON.stringify of the whole map froze the
   * process for seconds on the NAS (and built a 360 MB string each time).
   */
  private saveToDisk() {
    if (!this.persistFile) return;
    if (this.writeInFlight) {
      this.pendingWrite = true;
      return;
    }
    this.writeInFlight = true;
    this.writeStreamed(this.persistFile)
      .catch(() => {
        // Best-effort — losing the persisted cache just means a cold start next time.
      })
      .finally(() => {
        this.writeInFlight = false;
        if (this.pendingWrite) {
          this.pendingWrite = false;
          this.saveToDisk();
        }
      });
  }

  private async writeStreamed(file: string) {
    // Snapshot of references only: set() swaps entries rather than mutating
    // them, so later writes to the map can't tear this pass.
    const entries = [...this.store];
    const tmp = `${file}.tmp`;
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const handle = await fs.promises.open(tmp, "w");
    try {
      let chunk = "{";
      for (let i = 0; i < entries.length; i++) {
        const [key, entry] = entries[i];
        chunk += `${i === 0 ? "" : ","}${JSON.stringify(key)}:${JSON.stringify(entry)}`;
        if (chunk.length >= WRITE_CHUNK_CHARS) {
          await handle.write(chunk, null, "utf8");
          chunk = "";
        }
      }
      await handle.write(`${chunk}}`, null, "utf8");
    } finally {
      await handle.close();
    }
    await fs.promises.rename(tmp, file);
  }

  /** Debounced so a burst of writes (e.g. a cache-warm pass) doesn't re-serialize the whole map every call. */
  private scheduleSave() {
    if (!this.persistFile) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDisk(), SAVE_DEBOUNCE_MS);
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value as T;
  }

  /**
   * Stale-while-revalidate read: past the TTL the entry is kept and returned
   * with fresh=false instead of being dropped, so the caller can serve it
   * immediately and refresh in the background — the user never waits on the
   * upstream API for data we already have a recent copy of.
   */
  getStale<T>(key: string): { value: T; fresh: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    return { value: entry.value as T, fresh: entry.expiresAt >= Date.now() };
  }

  set<T>(key: string, value: T) {
    this.store.delete(key); // re-insert at the end so it counts as freshest for eviction order
    // No size measurement here on purpose — stats() does it lazily. See Entry.sizeBytes.
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    this.scheduleSave();
    this.maybeLogDiag();
  }

  /** Throttled so a burst of set() calls (e.g. a library scan) logs progress without flooding stdout. */
  private maybeLogDiag() {
    const now = Date.now();
    if (now - this.lastDiagAt < 15_000) return;
    this.lastDiagAt = now;
    const mem = process.memoryUsage();
    console.log(
      `[cache:${this.name}] entries=${this.store.size}/${this.maxEntries} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`
    );
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.saveToDisk();
  }

  stats() {
    let keySize = 0;
    let measuredSize = 0;
    let measuredCount = 0;
    let unmeasuredCount = 0;
    let budget = MEASURE_BUDGET_PER_STATS_CALL;

    for (const [k, entry] of this.store) {
      keySize += k.length;
      if (entry.sizeBytes === undefined) {
        if (budget > 0) {
          budget--;
          // Mirrors what the old JSON.stringify path did: a value that can't
          // be measured (a throwing getter) scores 0 rather than failing the
          // admin panel's whole request. Memoized either way, so a bad value
          // is not re-attempted on every poll.
          try {
            entry.sizeBytes = approxJsonSize(entry.value);
          } catch {
            entry.sizeBytes = 0;
          }
        } else {
          unmeasuredCount++;
          continue;
        }
      }
      measuredSize += entry.sizeBytes;
      measuredCount++;
    }

    // Entries left over past the budget are billed at the average of the ones
    // already measured, so the displayed total is right in magnitude from the
    // very first poll rather than climbing from zero as measurement catches up.
    const average = measuredCount > 0 ? measuredSize / measuredCount : 0;
    const valueSize = Math.round(measuredSize + unmeasuredCount * average);

    return {
      name: this.name,
      hits: this.hits,
      misses: this.misses,
      keys: this.store.size,
      maxEntries: this.maxEntries,
      keySizeBytes: keySize,
      valueSizeBytes: valueSize,
      /** True while part of the total is still extrapolated — the panel marks it "≈". */
      sizeEstimated: unmeasuredCount > 0,
      persisted: !!this.persistFile,
    };
  }
}

// Next compiles API routes into separate server bundles. A module-local Map
// therefore makes /api/metadata/*, /api/cache and the scheduler silently use
// different caches in one Node process: misses climb in the active route
// while the settings panel reports another instance's old counters. Keep the
// registry on globalThis so TMDb responses, statistics and Clear all refer to
// the same cache regardless of which route loaded this module first.
const g = globalThis as typeof globalThis & {
  __movvizNamedCaches?: Map<string, NamedCache>;
};
const registry: Map<string, NamedCache> = (g.__movvizNamedCaches ??= new Map());

export function getCache(name: string, ttlMs: number, persistFile?: string, maxEntries = DEFAULT_MAX_ENTRIES): NamedCache {
  let cache = registry.get(name);
  if (!cache) {
    cache = new NamedCache(name, ttlMs, persistFile, maxEntries);
    registry.set(name, cache);
  }
  return cache;
}

export function listCaches() {
  return [...registry.values()].map((c) => c.stats());
}

export function clearCache(name: string): boolean {
  const cache = registry.get(name);
  if (!cache) return false;
  cache.clear();
  return true;
}
