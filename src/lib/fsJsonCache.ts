import fs from "node:fs";

/**
 * Process-wide cache for the JSON files that back every Movviz store.
 *
 * Each store used to re-read AND re-parse its file on every call — and the
 * library files hold the full episode tree, so on a NAS every poll of every
 * API route burned CPU parsing megabytes of JSON on the main thread, stalling
 * all other requests. The parsed value is cached here and revalidated with a
 * single stat() call: if the file's mtime/size haven't changed the cached
 * object is returned as-is, otherwise it's re-parsed once. Writes go through
 * the same module so the cache is updated in the same beat as the file.
 *
 * Anchored on globalThis because Next.js compiles routes into separate
 * bundles — module-level state would exist once per bundle.
 */

interface CacheEntry {
  mtimeMs: number;
  size: number;
  value: unknown;
  /** Set while this value hasn't been confirmed on disk yet — reads trust it as-is instead of re-validating against a stat() that wouldn't reflect it yet. */
  pending?: boolean;
}

const g = globalThis as typeof globalThis & {
  __movvizFsJsonCache?: Map<string, CacheEntry>;
  __movvizMemoCache?: Map<string, { version: string; value: unknown }>;
  __movvizWriteQueues?: Map<string, Promise<void>>;
  __movvizPendingWrites?: Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>;
};
const cache: Map<string, CacheEntry> = (g.__movvizFsJsonCache ??= new Map());
const memoCache: Map<string, { version: string; value: unknown }> = (g.__movvizMemoCache ??= new Map());
/** One write-in-flight promise per file, so concurrent writes to the same store never interleave on disk even though they no longer block the caller. */
const writeQueues: Map<string, Promise<void>> = (g.__movvizWriteQueues ??= new Map());
/** Writes scheduled but not yet started — see the coalescing comment on writeJsonCached(). */
const pendingWrites: Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }> =
  (g.__movvizPendingWrites ??= new Map());
/** How long a burst of writes to the same file gets to settle before the coalesced write actually fires. */
const WRITE_COALESCE_MS = 300;

export function readJsonCached<T>(file: string, fallback: T): T {
  const hit = cache.get(file);
  if (hit?.pending) return hit.value as T;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return fallback;
  }
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    return hit.value as T;
  }
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return value;
  } catch {
    return fallback;
  }
}

/**
 * Cache-aware write for a store backed by `readJsonCached`. The in-memory
 * cache updates synchronously — every read in this process sees the new
 * value immediately, including ones issued right after this call returns —
 * while the actual disk write (temp file + rename, still atomic against a
 * mid-write crash) happens in the background instead of blocking the caller.
 * Stays a plain synchronous function on purpose: nothing calling it has to
 * change, unlike making it `async` which would cascade `await` through every
 * caller of every store's add/update functions across the app.
 *
 * Writes to the same file are still serialized (queued), so two calls in
 * quick succession — e.g. two concurrent items in a bulk import touching the
 * same library file — can never interleave into a corrupted write; only the
 * caller's wait for durability is what's removed, not the ordering guarantee.
 *
 * Trade-off accepted deliberately: if the process crashes in the brief
 * window before a queued write reaches disk (typically well under a second),
 * that specific change can be lost on restart. Every write before it is
 * still durable — only the tail of a burst is ever at risk.
 *
 * Coalesced on top of that: a caller looping over a whole library calling
 * this once per item (e.g. a metadata refresh over a few thousand movies) —
 * doubly so once several such loops from different background jobs land on
 * the same file at once — used to serialize into a queue of full-array
 * JSON.stringify's, each one held in memory until its turn to actually
 * write. Faster incoming writes than disk I/O could drain meant that queue
 * (and the memory behind it) grew without bound and OOM'd the process.
 * Now a write is only *scheduled*, not started, and a further write to the
 * same file within WRITE_COALESCE_MS just replaces what will be written —
 * a tight burst collapses into one disk write of the final state instead of
 * N of them.
 */
export function writeJsonCached(file: string, value: unknown): void {
  cache.set(file, { mtimeMs: -1, size: -1, value, pending: true });

  const existing = pendingWrites.get(file);
  if (existing) {
    existing.value = value;
    return;
  }

  const timer = setTimeout(() => {
    const pending = pendingWrites.get(file);
    pendingWrites.delete(file);
    const finalValue = pending ? pending.value : value;

    const json = JSON.stringify(finalValue, null, 2);
    const tmp = `${file}.tmp`;
    const prior = writeQueues.get(file) ?? Promise.resolve();
    const queued = prior
      .then(() => fs.promises.writeFile(tmp, json, "utf8"))
      .then(() => fs.promises.rename(tmp, file))
      .then(() => fs.promises.stat(file))
      .then((stat) => {
        // Only reconcile to a real stat if nothing newer has been queued since —
        // otherwise this would stamp a stale mtime/size over a fresher pending value.
        const current = cache.get(file);
        if (current?.value === finalValue) {
          cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value: finalValue });
        }
      })
      .catch((err) => {
        console.error(`[fsJsonCache] background write failed for ${file}:`, err);
      });
    writeQueues.set(file, queued);
  }, WRITE_COALESCE_MS);

  pendingWrites.set(file, { value, timer });
}

/**
 * Memoize an expensive derived computation (e.g. scanning the whole
 * library for missing/cutoff-unmet items) keyed by the mtime/size of the
 * source files it reads. Cheap on every call (just a handful of statSync),
 * and only re-runs `compute` once the underlying data actually changed —
 * so polling the same derived endpoint every few seconds doesn't re-walk
 * the whole library each time.
 */
export function memoizeByFileMtimes<T>(key: string, files: string[], compute: () => T): T {
  const version = files
    .map((f) => {
      try {
        const s = fs.statSync(f);
        return `${s.mtimeMs}:${s.size}`;
      } catch {
        return "missing";
      }
    })
    .join("|");
  const hit = memoCache.get(key);
  if (hit && hit.version === version) return hit.value as T;
  const value = compute();
  memoCache.set(key, { version, value });
  return value;
}
