import fs from "node:fs";
import zlib from "node:zlib";
import { getJsonWritePool } from "./workers/jsonWritePool";

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
  __movvizMemoCacheAsync?: Map<string, { version: string; value: unknown }>;
  __movvizMemoInFlightAsync?: Map<string, Promise<unknown>>;
  __movvizPendingWrites?: Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>;
  __movvizWriteInFlight?: Map<string, boolean>;
  __movvizPendingFileWrites?: Map<string, unknown>;
  __movvizLastKnownSize?: Map<string, number>;
  __movvizJsonBodyMemo?: Map<string, { version: string; body: string; gzip: Buffer | null }>;
};
const cache: Map<string, CacheEntry> = (g.__movvizFsJsonCache ??= new Map());
export const memoCache: Map<string, { version: string; value: unknown }> = (g.__movvizMemoCache ??= new Map());
const memoCacheAsync: Map<string, { version: string; value: unknown }> = (g.__movvizMemoCacheAsync ??= new Map());
const memoInFlightAsync: Map<string, Promise<unknown>> = (g.__movvizMemoInFlightAsync ??= new Map());
/** Writes scheduled but not yet started — see the coalescing comment on writeJsonCached(). */
const pendingWrites: Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }> =
  (g.__movvizPendingWrites ??= new Map());
/** Semaphore: is a write currently in flight for this file? Max 1 at any time. */
const writeInFlight: Map<string, boolean> = (g.__movvizWriteInFlight ??= new Map());
/** Slot for the single pending write value when a write is in flight. At most 1 value stored. */
const pendingFileWrites: Map<string, unknown> = (g.__movvizPendingFileWrites ??= new Map());
/** How long a burst of writes to the same file gets to settle before the coalesced write actually fires. */
const WRITE_COALESCE_MS = 300;
/**
 * Last known on-disk size per file, updated by both readJsonCached and a
 * completed write — used to decide whether the NEXT write is big enough to
 * offload (see LARGE_FILE_WORKER_THRESHOLD_BYTES below). Kept separate from
 * `cache` because writeJsonCached() immediately marks the cache entry's size
 * as -1 (pending) before the actual write ever runs, so `cache` alone can't
 * answer "was this file already large" at the moment startFileWrite needs it.
 */
const lastKnownSize: Map<string, number> = (g.__movvizLastKnownSize ??= new Map());
/**
 * Above this size, a write's JSON.stringify is expensive enough (tens of ms
 * on a dev machine, measured several times that on NAS-class CPUs — see
 * PRETTY_MAX_BYTES below) to matter if it runs on the main thread: it blocks
 * every other request on the same process for its whole duration, including
 * unrelated ones like the Docker health check. Past this size the stringify
 * + atomic write is dispatched to a worker_threads pool instead (see
 * jsonWritePool.ts) so the main thread stays free. Small stores (settings,
 * indexers, users...) stay on the fast inline path — not worth an IPC
 * round-trip for something that costs under a millisecond either way.
 */
const LARGE_FILE_WORKER_THRESHOLD_BYTES = 1_000_000;

/**
 * Above this compact-JSON size, skip pretty-printing. Indentation on the
 * library files was pure waste at scale: library-series.json measured
 * 22.4 MB indented vs 13.8 MB compact, and ~52 ms vs ~29 ms to stringify
 * (dev machine — several times that on the NAS CPU) — paid on the main
 * thread at every coalesced write during a bulk search. Small config files
 * (users, indexers…) stay indented since they're the ones a human actually
 * opens, and re-stringifying a few KB costs nothing.
 */
const PRETTY_MAX_BYTES = 256 * 1024;

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
    lastKnownSize.set(file, stat.size);
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

    startFileWrite(file, finalValue);
  }, WRITE_COALESCE_MS);

  pendingWrites.set(file, { value, timer });
}

/**
 * Start a file write using a semaphore to bound the chain to at most 1
 * in-flight write. If a write is already in progress, the value is stored
 * in a single-slot `pendingFileWrites` — it will be picked up when the
 * current write finishes, without chaining promises.
 *
 * This prevents the old unbounded promise-chain pattern where slow disk
 * (NAS) caused each coalesced write to chain a ~14 MB JSON string in a
 * closure, growing until OOM.
 */
function startFileWrite(file: string, val: unknown) {
  if (writeInFlight.get(file)) {
    pendingFileWrites.set(file, val);
    return;
  }

  writeInFlight.set(file, true);

  const applyResult = (stat: { mtimeMs: number; size: number }) => {
    lastKnownSize.set(file, stat.size);
    const current = cache.get(file);
    if (current?.value === val) {
      cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value: val });
    }
  };

  // Past the threshold, stringify + write runs in a worker so the main
  // thread never blocks on it (see LARGE_FILE_WORKER_THRESHOLD_BYTES).
  // Below it, the previous inline path stays exactly as it was — cheapest
  // for the many small stores that never come close to the threshold.
  const doWrite = ((lastKnownSize.get(file) ?? 0) >= LARGE_FILE_WORKER_THRESHOLD_BYTES
    ? getJsonWritePool().run({ file, value: val }, 30_000).then(applyResult)
    : Promise.resolve().then(() => {
        const compact = JSON.stringify(val);
        const json = compact.length <= PRETTY_MAX_BYTES ? JSON.stringify(val, null, 2) : compact;
        const tmp = `${file}.tmp`;
        return fs.promises
          .writeFile(tmp, json, "utf8")
          .then(() => fs.promises.rename(tmp, file))
          .then(() => fs.promises.stat(file))
          .then(applyResult);
      })
  ).catch((err: unknown) => {
    console.error(`[fsJsonCache] background write failed for ${file}:`, err);
  });

  doWrite.finally(() => {
    writeInFlight.set(file, false);
    const next = pendingFileWrites.get(file);
    if (next !== undefined) {
      pendingFileWrites.delete(file);
      startFileWrite(file, next);
    }
  });
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

/**
 * Async counterpart to `memoizeByFileMtimes` — for a derived computation
 * that's dispatched to a worker_threads pool (postMessage is inherently
 * async) instead of run inline. Same mtime/size versioning, plus an
 * in-flight guard: several callers landing on a stale version at once (e.g.
 * a burst of polls right after the library changed) share the same
 * in-progress computation instead of each queuing its own worker task.
 */
export async function memoizeByFileMtimesAsync<T>(
  key: string,
  files: string[],
  compute: () => Promise<T>
): Promise<T> {
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
  const hit = memoCacheAsync.get(key);
  if (hit && hit.version === version) return hit.value as T;

  const inFlight = memoInFlightAsync.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const promise = compute()
    .then((value) => {
      memoCacheAsync.set(key, { version, value });
      return value;
    })
    .finally(() => {
      memoInFlightAsync.delete(key);
    });
  memoInFlightAsync.set(key, promise);
  return promise;
}

const jsonBodyMemo: Map<string, { version: string; body: string; gzip: Buffer | null }> =
  (g.__movvizJsonBodyMemo ??= new Map());

/**
 * Memoize a fully serialized JSON response (plain string + optional gzip
 * buffer) keyed by the mtime/size of the source files it was built from,
 * plus each file's pending-write flag. Reading back the memoized body costs
 * only a few statSync calls, so a large-library endpoint (16+ MB of series
 * JSON on a NAS-class CPU takes seconds to stringify) serves subsequent
 * requests in milliseconds instead of re-parsing and re-serializing the
 * whole library on every poll. The `build` callback runs once per data
 * version — at most once per write burst, never once per request — and the
 * gzip variant is compressed once per version too, cutting the same payload
 * from ~16 MB to ~2 MB on the wire without paying zlib per request.
 */
export function memoJsonBody(
  key: string,
  files: string[],
  build: () => string,
  withGzip = false
): { body: string; gzip: Buffer | null } {
  const version = files
    .map((f) => {
      try {
        const st = fs.statSync(f);
        return `${st.mtimeMs}:${st.size}:${cache.get(f)?.pending ? "pending" : "disk"}`;
      } catch {
        return "missing";
      }
    })
    .join("|");
  const hit = jsonBodyMemo.get(key);
  if (hit && hit.version === version) return hit;
  const body = build();
  const gzip = withGzip ? zlib.gzipSync(body) : null;
  const value = { version, body, gzip };
  jsonBodyMemo.set(key, value);
  return value;
}
