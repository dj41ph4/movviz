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
   * JSON size of `value`, computed once at set(). stats() used to
   * re-serialize every cached value on each call — with the TMDb cache full
   * (2000 entries, ~12 MB of JSON) that meant megabytes of stringify work
   * per poll of the cache panel, on the main thread. Absent on entries
   * loaded from a persist file written before this field existed.
   */
  sizeBytes?: number;
}

// Unbounded before this — a bulk operation touching thousands of distinct
// URLs (e.g. scanning a whole library for the first time) kept every
// response in memory forever, since eviction only ever happened lazily on a
// read of that exact expired key. That grew until the process ran out of
// heap. Map preserves insertion order, so capping here just means "evict the
// oldest entry" — an approximation of LRU that's good enough for an API
// response cache.
const MAX_ENTRIES = 2000;

// The persist file is only a warm-start optimization: losing its tail on a
// crash costs one extra upstream fetch per lost entry, nothing more. It was
// 2 s before, which during any metadata-heavy stretch (Discover browsing, a
// library scan) meant re-writing the whole ~12 MB file every couple of
// seconds — and synchronously, which froze the entire process for as long
// as the NAS disk (often busy seeding/downloading at the same time) took to
// swallow it: app unresponsive, CPU idle, API calls timing out.
const SAVE_DEBOUNCE_MS = 30_000;

class NamedCache {
  private store = new Map<string, Entry<unknown>>();
  hits = 0;
  misses = 0;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastDiagAt = 0;
  /** Serializes background writes to the persist file so they never interleave. */
  private writeChain: Promise<void> = Promise.resolve();

  constructor(public readonly name: string, private ttlMs: number, private persistFile?: string) {
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
   * and could leave a truncated file behind on a crash mid-write. Only the
   * JSON.stringify still runs on the main thread (~40 ms for a full TMDb
   * cache), once per SAVE_DEBOUNCE_MS at most.
   */
  private saveToDisk() {
    const file = this.persistFile;
    if (!file) return;
    const json = JSON.stringify(Object.fromEntries(this.store));
    const tmp = `${file}.tmp`;
    this.writeChain = this.writeChain
      .then(async () => {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(tmp, json, "utf8");
        await fs.promises.rename(tmp, file);
      })
      .catch(() => {
        // Best-effort — losing the persisted cache just means a cold start next time.
      });
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
    let sizeBytes = 0;
    try {
      sizeBytes = JSON.stringify(value)?.length ?? 0;
    } catch {
      // Unserializable values can't be persisted anyway; 0 keeps stats honest enough.
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs, sizeBytes });
    while (this.store.size > MAX_ENTRIES) {
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
      `[cache:${this.name}] entries=${this.store.size}/${MAX_ENTRIES} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`
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
    let valueSize = 0;
    for (const [k, v] of this.store) {
      keySize += k.length;
      valueSize += v.sizeBytes ?? 0;
    }
    return {
      name: this.name,
      hits: this.hits,
      misses: this.misses,
      keys: this.store.size,
      keySizeBytes: keySize,
      valueSizeBytes: valueSize,
      persisted: !!this.persistFile,
    };
  }
}

const registry = new Map<string, NamedCache>();

export function getCache(name: string, ttlMs: number, persistFile?: string): NamedCache {
  let cache = registry.get(name);
  if (!cache) {
    cache = new NamedCache(name, ttlMs, persistFile);
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
