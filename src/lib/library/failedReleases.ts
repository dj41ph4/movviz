import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { isBlockedRelease } from "@/lib/library/blockedReleases";

/**
 * A release whose torrent the engine abandoned because no peer held the
 * last piece(s) ("no_peers_for_piece") is a dead source — that will still
 * be true on the next automatic search, since the same top-scored release
 * (now cached via the RSS index) gets picked again, dies again, forever.
 * Recording it here for a cooldown lets grabRelease/tryGrabSeasonPack/
 * tryGrabSeriesPack skip it and fall through to the next candidate instead
 * of looping on a source that will never complete.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "failed-releases.json");
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface FailedRelease {
  infoHash: string;
  failedAt: number;
  seriesId?: string;
  releaseTitle?: string;
}

function read(): FailedRelease[] {
  return readJsonCached<FailedRelease[]>(FILE, []);
}

export function recordFailedRelease(infoHash: string, details?: { seriesId: string; releaseTitle: string }) {
  if (!infoHash) return;
  const now = Date.now();
  const list = read().filter((r) => now - r.failedAt < COOLDOWN_MS && r.infoHash !== infoHash);
  list.push({ infoHash, failedAt: now, ...details });
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function isRecentlyFailedRelease(infoHash: string | null | undefined): boolean {
  if (!infoHash) return false;
  const now = Date.now();
  return isBlockedRelease(infoHash) || read().some((r) => r.infoHash === infoHash && now - r.failedAt < COOLDOWN_MS);
}

/** Indexers may omit the info hash. An exact title scoped to the same series
 * is a fallback for the same source during the short failed-release cooldown. */
export function isRecentlyFailedSeriesPack(seriesId: string, release: { infoHash: string | null; title: string }): boolean {
  if (isRecentlyFailedRelease(release.infoHash)) return true;
  if (release.infoHash) return false;
  const title = release.title.trim().toLocaleLowerCase();
  return !!title && read().some((r) => r.seriesId === seriesId && r.releaseTitle?.trim().toLocaleLowerCase() === title && Date.now() - r.failedAt < COOLDOWN_MS);
}
