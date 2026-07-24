import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { ActivityEntry, ActivityMedia, ActivityRelease, ActivityDownload, ActivityImport, ActivityFailureReason } from "./types";
import { eventBus } from "@/lib/events/EventBus";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "activity-v2.json");
const MAX_KEEP = 2000;

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

function generateId(): string {
  return `ac_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function loadActivityV2(): ActivityEntry[] {
  return readJson<ActivityEntry[]>(FILE, []).sort((a, b) => b.timestamp - a.timestamp);
}

export function logActivityV2(entry: Omit<ActivityEntry, "id" | "timestamp">): ActivityEntry {
  const list = readJson<ActivityEntry[]>(FILE, []);
  const fullEntry: ActivityEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  list.unshift(fullEntry);
  writeJson(FILE, list.slice(0, MAX_KEEP));
  eventBus.emit({ type: "activity_updated" });
  return fullEntry;
}

export function clearActivityV2() {
  writeJson(FILE, []);
}

export function getActivityEntryV2(id: string): ActivityEntry | null {
  return readJson<ActivityEntry[]>(FILE, []).find((e) => e.id === id) ?? null;
}

export function updateActivityEntryV2(id: string, patch: Partial<ActivityEntry>): ActivityEntry | null {
  const list = readJson<ActivityEntry[]>(FILE, []);
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  writeJson(FILE, list);
  return list[i];
}

export function createMediaRef(
  type: "movie" | "series",
  id: string,
  tmdbId: number,
  title: string,
  season?: number,
  episode?: number
): ActivityMedia {
  return {
    id,
    title,
    type,
    season,
    episode,
    href: type === "movie" ? `/title/movie/${tmdbId}` : `/title/series/${tmdbId}`,
  };
}

export function createReleaseRef(
  indexer: string,
  releaseTitle: string,
  protocol: "torrent" | "usenet",
  size: number,
  quality: string,
  score: number,
  seeders?: number,
  leechers?: number,
  customFormats: string[] = []
): ActivityRelease {
  return {
    indexer,
    releaseTitle,
    protocol,
    size,
    quality,
    score,
    seeders,
    leechers,
    customFormats,
  };
}

export function createDownloadRef(
  client: string,
  infoHash: string,
  progress: number,
  downloadSpeed: number,
  uploadSpeed: number,
  eta: number,
  ratio: number,
  peers: number,
  state: ActivityDownload["state"]
): ActivityDownload {
  return {
    client,
    infoHash,
    progress,
    downloadSpeed,
    uploadSpeed,
    eta,
    ratio,
    peers,
    state,
  };
}

export function createImportRef(
  destinationPath: string,
  fileSize: number,
  fileName: string,
  qualityDetected: string,
  languages: string[] = [],
  subtitles: string[] = []
): ActivityImport {
  return {
    destinationPath,
    fileSize,
    fileName,
    qualityDetected,
    languages,
    subtitles,
  };
}

export function createFailureRef(
  code: ActivityFailureReason["code"],
  message: string,
  details?: Record<string, unknown>
): ActivityFailureReason {
  return { code, message, details };
}