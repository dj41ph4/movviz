/**
 * Phase 2 — persistent cache for MediaDescriptor (see
 * PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md §9). Never re-probes a file on every
 * playback: the cache is only invalidated when the file itself changed
 * (path/size/mtime — plan §8) or the probe's own mapping logic changed
 * (PROBE_VERSION), matching the existing CONFIG_DIR/FILE/readJson/writeJson
 * shape used by every other small JSON store in src/lib/*​/store.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { getFfprobeVersion, probeMediaFile, probeRemoteMedia } from "./mediaProbe";
import type { MediaDescriptor } from "./mediaDescriptor";
import { probeLimiter, type LimitedTask, type ProbePriority } from "./probeLimiter";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "media-probe-cache.json");
const REMOTE_FILE = path.join(CONFIG_DIR, "media-probe-remote-cache.json");
const REMOTE_TTL_MS = 6 * 60 * 60 * 1000;

// Bump when probeMediaFile()'s mapping logic changes in a way that would
// produce a different MediaDescriptor for the same file — forces every
// cached entry to be re-probed once instead of silently serving a stale
// shape forever.
const PROBE_VERSION = 1;

interface CacheEntry {
  mediaId: string;
  path: string;
  size: number;
  mtimeMs: number;
  probeVersion: number;
  ffprobeVersion: string | null;
  descriptor: MediaDescriptor;
  updatedAt: number;
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

function loadAll(): CacheEntry[] {
  return readJson<CacheEntry[]>(FILE, []);
}

/**
 * The cache holds one entry per file of the library (~40 000 on a real
 * one). Two costs used to freeze the server while media-probe-library
 * walked it, 1 to 4 s at a time:
 *  - every lookup scanned the whole array (40 000 × 40 000 comparisons per
 *    pass) → an index by mediaId, rebuilt only when the array itself is
 *    replaced (read from disk, or a flush below);
 *  - every newly probed file rewrote the whole cache, and handing ~50 MB to
 *    the write worker clones it ON the main thread → new entries wait in an
 *    in-memory overlay and reach the file at most every FLUSH_EVERY_MS.
 * Losing the overlay to a hard kill only costs a re-probe of those files
 * (this is a cache); a clean stop flushes it (instrumentation.ts).
 */
const FLUSH_EVERY_MS = 30_000;
const gc = globalThis as typeof globalThis & {
  __movvizProbeOverlay?: Map<string, CacheEntry | null>;
  __movvizProbeIndex?: { source: CacheEntry[]; byId: Map<string, CacheEntry> };
  __movvizProbeFlushTimer?: ReturnType<typeof setTimeout> | null;
  __movvizProbeLastFlush?: number;
};
/** mediaId → entry not yet written (null: removed). */
const overlay = (gc.__movvizProbeOverlay ??= new Map());

function diskIndex(): Map<string, CacheEntry> {
  const source = loadAll();
  if (gc.__movvizProbeIndex?.source !== source) {
    const byId = new Map<string, CacheEntry>();
    for (const e of source) byId.set(e.mediaId, e);
    gc.__movvizProbeIndex = { source, byId };
  }
  return gc.__movvizProbeIndex.byId;
}

function lookup(mediaId: string): CacheEntry | undefined {
  if (overlay.has(mediaId)) return overlay.get(mediaId) ?? undefined;
  return diskIndex().get(mediaId);
}

/** Writes the overlay into the file now (one clone, whatever its size). */
export function flushMediaProbeCache(): void {
  if (gc.__movvizProbeFlushTimer) { clearTimeout(gc.__movvizProbeFlushTimer); gc.__movvizProbeFlushTimer = null; }
  if (overlay.size === 0) return;
  const next = loadAll().filter((e) => !overlay.has(e.mediaId));
  for (const e of overlay.values()) if (e) next.push(e);
  overlay.clear();
  gc.__movvizProbeLastFlush = Date.now();
  writeJson(FILE, next);
}

function put(mediaId: string, entry: CacheEntry | null): void {
  overlay.set(mediaId, entry);
  if (gc.__movvizProbeFlushTimer) return;
  const wait = Math.max(0, (gc.__movvizProbeLastFlush ?? 0) + FLUSH_EVERY_MS - Date.now());
  const timer = setTimeout(() => { gc.__movvizProbeFlushTimer = null; flushMediaProbeCache(); }, wait);
  timer.unref?.();
  gc.__movvizProbeFlushTimer = timer;
}

/**
 * Returns the cached `MediaDescriptor` for `mediaId` if the file at
 * `filePath` hasn't changed since it was last probed, otherwise probes it
 * fresh and updates the cache. Returns null (never throws) when the file
 * doesn't exist — a missing file is a normal, expected caller-facing state
 * here (e.g. a library entry whose disk file was moved/deleted), not an
 * exceptional one.
 *
 * `force: true` (TODO_POST_MOTEUR_LECTURE.md item 2 — "analyse complète")
 * skips the cache-match check entirely and always re-probes, for a user who
 * explicitly wants to bypass the cache rather than trust it — the normal
 * incremental behavior above already re-probes on its own whenever the file
 * actually changed, so `force` is only ever about a caller's own doubt in
 * the cache, not a correctness requirement.
 */
interface InflightProbe {
  filePath: string;
  task: LimitedTask<MediaDescriptor | null>;
}

interface FailedProbe {
  path: string;
  size: number;
  mtimeMs: number;
}

// globalThis for the same reason as probeLimiter: one map per process, not per route bundle.
const g = globalThis as typeof globalThis & {
  __movvizProbeInflight?: Map<string, InflightProbe>;
  __movvizProbeFailed?: Map<string, FailedProbe>;
};
const inflight = (g.__movvizProbeInflight ??= new Map());
/** Files whose last probe failed, keyed by mediaId. Background callers skip
 *  them until the file itself changes, so one bad file (or one overloaded
 *  night) never turns into a retry on every sync. Foreground callers always
 *  retry. In-memory only: a restart gives every failure one fresh attempt. */
const failed = (g.__movvizProbeFailed ??= new Map());
const FAILED_FILE = path.join(CONFIG_DIR, "media-probe-failed.json");
let failedLoaded = false;

/** Les échecs survivent au redémarrage : un fichier réellement cassé (début
 *  vide, mp4 tronqué…) ne redevient candidat que s'il change sur le disque. */
function ensureFailedLoaded(): void {
  if (failedLoaded) return;
  failedLoaded = true;
  const saved = readJson<Record<string, FailedProbe>>(FAILED_FILE, {});
  for (const [id, f] of Object.entries(saved)) if (!failed.has(id)) failed.set(id, f);
}
function persistFailed(): void {
  writeJson(FAILED_FILE, Object.fromEntries(failed));
}

const ZERO_HEAD_BYTES = 4096;

/** Un média valide ne commence jamais par 4 Ko de zéros (en-têtes EBML/MP4/AVI
 *  non nuls) : c'est un fichier pré-alloué, jamais rempli ou écrasé. Inutile de
 *  lancer ffprobe pour obtenir « EBML header parsing failed ». */
async function assertReadableHead(filePath: string): Promise<void> {
  // Never a synchronous read of a media file: on a NAS whose disks are busy
  // (or waking up) it takes seconds, and the whole server waits with it.
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(ZERO_HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, ZERO_HEAD_BYTES, 0);
    if (bytesRead > 0 && buf.subarray(0, bytesRead).every((b) => b === 0)) {
      throw new Error("début du fichier vide (téléchargement incomplet ou fichier corrompu)");
    }
  } finally {
    await handle.close().catch(() => { /* already closed */ });
  }
}

function cacheMatches(existing: CacheEntry | undefined, filePath: string, stat: fs.Stats, ffprobeVersion: string | null): existing is CacheEntry {
  return (
    !!existing &&
    existing.probeVersion === PROBE_VERSION &&
    existing.ffprobeVersion === ffprobeVersion &&
    existing.path === filePath &&
    existing.size === stat.size &&
    existing.mtimeMs === stat.mtimeMs
  );
}

/** Cheap in-memory check (no disk stat): has this media ever been probed successfully? */
export function hasCachedMediaDescriptor(mediaId: string): boolean {
  return !!lookup(mediaId);
}

export async function getOrProbeMediaDescriptor(
  mediaId: string,
  filePath: string,
  force = false,
  opts?: { priority?: ProbePriority }
): Promise<MediaDescriptor | null> {
  const priority = opts?.priority ?? "foreground";
  let stat: fs.Stats;
  try {
    // Asynchronous for the same reason as assertReadableHead: the library
    // pass asks this for every file, and a slow disk must not freeze requests.
    stat = await fs.promises.stat(filePath);
  } catch {
    return null;
  }

  const ffprobeVersion = await getFfprobeVersion();
  const existing = lookup(mediaId);
  if (!force && cacheMatches(existing, filePath, stat, ffprobeVersion)) return existing.descriptor;

  if (priority === "background" && !force) {
    ensureFailedLoaded();
    const f = failed.get(mediaId);
    if (f && f.path === filePath && f.size === stat.size && f.mtimeMs === stat.mtimeMs) return null;
  }

  // Same file already queued or running: share its result instead of
  // spawning a second ffprobe. A foreground caller pulls a still-queued
  // background probe ahead of the queue.
  const pending = inflight.get(mediaId);
  if (pending && pending.filePath === filePath && !force) {
    if (priority === "foreground") pending.task.promote();
    return pending.task.promise;
  }

  const task = probeLimiter.run(priority, async () => {
    // Re-check once a slot is ours: the file may have been probed while this task waited.
    let fresh: fs.Stats;
    try {
      fresh = await fs.promises.stat(filePath);
    } catch {
      return null; // moved or deleted while queued
    }
    const cached = lookup(mediaId);
    if (!force && cacheMatches(cached, filePath, fresh, ffprobeVersion)) return cached.descriptor;
    try {
      await assertReadableHead(filePath);
      const descriptor = await probeMediaFile(mediaId, filePath);
      ensureFailedLoaded();
      if (failed.delete(mediaId)) persistFailed();
      saveEntry(mediaId, filePath, fresh, ffprobeVersion, descriptor);
      return descriptor;
    } catch (err) {
      ensureFailedLoaded();
      failed.set(mediaId, { path: filePath, size: fresh.size, mtimeMs: fresh.mtimeMs });
      persistFailed();
      throw err;
    }
  });
  const entry: InflightProbe = { filePath, task };
  inflight.set(mediaId, entry);
  try {
    return await task.promise;
  } finally {
    if (inflight.get(mediaId) === entry) inflight.delete(mediaId);
  }
}

function saveEntry(mediaId: string, filePath: string, stat: fs.Stats, ffprobeVersion: string | null, descriptor: MediaDescriptor): void {
  const next: CacheEntry = {
    mediaId,
    path: filePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    probeVersion: PROBE_VERSION,
    ffprobeVersion,
    descriptor,
    updatedAt: Date.now(),
  };
  // Merged into the latest cache at flush time, never into a snapshot taken
  // before the probe: other probes finish in between (see put/flush above).
  put(mediaId, next);
}

/**
 * A file renamed and/or renumbered by Movviz itself (anime resync) keeps its
 * analysis: same bytes, so the entry simply follows it to its new id and
 * path. Without this, every renamed file looked "never probed" and the next
 * library pass re-ran ffprobe on thousands of episodes at once. A rename
 * keeps size and date; if they differ after all, the usual staleness check
 * re-probes the file — nothing wrong can be served.
 */
export function carryMediaProbeEntries(moves: Array<{ fromId: string; fromPath: string; toId: string; toPath: string }>): number {
  // Read every source first: ids are swapped within one batch (E09→E10, E10→E11).
  const carried = moves.flatMap((m) => {
    const entry = lookup(m.fromId);
    return entry && entry.path === m.fromPath ? [{ m, entry }] : [];
  });
  const targets = new Set(carried.map((c) => c.m.toId));
  for (const { m } of carried) if (!targets.has(m.fromId)) put(m.fromId, null);
  for (const { m, entry } of carried) {
    put(m.toId, { ...entry, mediaId: m.toId, path: m.toPath, descriptor: { ...entry.descriptor, mediaId: m.toId }, updatedAt: Date.now() });
  }
  return carried.length;
}

/** Explicit invalidation — e.g. after a file is replaced by a manual re-grab
 *  that happens to keep the exact same size+mtime (rare, but possible) and
 *  would otherwise slip past the automatic staleness check above. */
export function invalidateMediaDescriptor(mediaId: string): void {
  put(mediaId, null);
}


interface RemoteCacheEntry {
  mediaId: string;
  sourceUrl: string;
  probeVersion: number;
  ffprobeVersion: string | null;
  descriptor: MediaDescriptor;
  updatedAt: number;
}

/** Plex raw-file descriptors cannot use filesystem size/mtime invalidation.
 * Cache them for six hours and re-probe after a server/app restart window or
 * when the resolved part URL changes.  No transcode API is involved. */
export async function getOrProbeRemoteMediaDescriptor(
  mediaId: string,
  sourceUrl: string,
  headers: Record<string, string>,
  force = false
): Promise<MediaDescriptor | null> {
  const entries = readJson<RemoteCacheEntry[]>(REMOTE_FILE, []);
  const ffprobeVersion = await getFfprobeVersion();
  const existing = entries.find((e) => e.mediaId === mediaId);
  if (
    !force && existing &&
    existing.probeVersion === PROBE_VERSION &&
    existing.ffprobeVersion === ffprobeVersion &&
    existing.sourceUrl === sourceUrl &&
    Date.now() - existing.updatedAt < REMOTE_TTL_MS
  ) return existing.descriptor;

  try {
    const descriptor = await probeLimiter.run("foreground", () => probeRemoteMedia(mediaId, sourceUrl, headers)).promise;
    const next: RemoteCacheEntry = { mediaId, sourceUrl, probeVersion: PROBE_VERSION, ffprobeVersion, descriptor, updatedAt: Date.now() };
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    // Re-read for the same reason as the local cache above — `entries` predates the probe.
    const current = readJson<RemoteCacheEntry[]>(REMOTE_FILE, []);
    writeJsonCached(REMOTE_FILE, [...current.filter((e) => e.mediaId !== mediaId), next]);
    return descriptor;
  } catch (err) {
    console.error(`[media-probe] remote probe failed for ${mediaId}:`, err);
    return null;
  }
}
