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
export async function getOrProbeMediaDescriptor(mediaId: string, filePath: string, force = false): Promise<MediaDescriptor | null> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  const entries = loadAll();
  const existing = entries.find((e) => e.mediaId === mediaId);
  const ffprobeVersion = await getFfprobeVersion();
  if (
    !force &&
    existing &&
    existing.probeVersion === PROBE_VERSION &&
    existing.ffprobeVersion === ffprobeVersion &&
    existing.path === filePath &&
    existing.size === stat.size &&
    existing.mtimeMs === stat.mtimeMs
  ) {
    return existing.descriptor;
  }

  const descriptor = await probeMediaFile(mediaId, filePath);
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
  saveAll([...entries.filter((e) => e.mediaId !== mediaId), next]);
  return descriptor;
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
    const descriptor = await probeRemoteMedia(mediaId, sourceUrl, headers);
    const next: RemoteCacheEntry = { mediaId, sourceUrl, probeVersion: PROBE_VERSION, ffprobeVersion, descriptor, updatedAt: Date.now() };
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    writeJsonCached(REMOTE_FILE, [...entries.filter((e) => e.mediaId !== mediaId), next]);
    return descriptor;
  } catch (err) {
    console.error(`[media-probe] remote probe failed for ${mediaId}:`, err);
    return null;
  }
}
