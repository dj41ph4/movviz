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
function saveAll(entries: CacheEntry[]) {
  writeJson(FILE, entries);
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
  return loadAll().some((e) => e.mediaId === mediaId);
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
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  const ffprobeVersion = await getFfprobeVersion();
  const existing = loadAll().find((e) => e.mediaId === mediaId);
  if (!force && cacheMatches(existing, filePath, stat, ffprobeVersion)) return existing.descriptor;

  if (priority === "background" && !force) {
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
      fresh = fs.statSync(filePath);
    } catch {
      return null; // moved or deleted while queued
    }
    const cached = loadAll().find((e) => e.mediaId === mediaId);
    if (!force && cacheMatches(cached, filePath, fresh, ffprobeVersion)) return cached.descriptor;
    try {
      const descriptor = await probeMediaFile(mediaId, filePath);
      failed.delete(mediaId);
      saveEntry(mediaId, filePath, fresh, ffprobeVersion, descriptor);
      return descriptor;
    } catch (err) {
      failed.set(mediaId, { path: filePath, size: fresh.size, mtimeMs: fresh.mtimeMs });
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
  // Always merge into the latest cache, never a snapshot taken before the
  // probe: other probes finish in between, and writing "old snapshot + my
  // entry" used to silently drop their results. writeJsonCached updates its
  // in-memory copy synchronously (fsJsonCache.ts), so this merge isn't racy.
  saveAll([...loadAll().filter((e) => e.mediaId !== mediaId), next]);
}

/** Explicit invalidation — e.g. after a file is replaced by a manual re-grab
 *  that happens to keep the exact same size+mtime (rare, but possible) and
 *  would otherwise slip past the automatic staleness check above. */
export function invalidateMediaDescriptor(mediaId: string): void {
  saveAll(loadAll().filter((e) => e.mediaId !== mediaId));
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
