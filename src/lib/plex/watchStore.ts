import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-watch-status.json");

export interface WatchStatus {
  userId: string;
  movies: number[]; // tmdbIds this user has watched
  episodes: { tmdbId: number; season: number; episode: number }[]; // tmdbId = series
  updatedAt: number;
}

function read(): WatchStatus[] {
  return readJsonCached<WatchStatus[]>(FILE, []);
}
function write(list: WatchStatus[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function getWatchStatus(userId: string): WatchStatus | null {
  return read().find((w) => w.userId === userId) ?? null;
}

/** Every account's watch status — used by the recommender to blend in what
 *  the rest of the household is watching, not just the target account alone. */
export function getAllWatchStatuses(): WatchStatus[] {
  return read();
}

export function saveWatchStatus(status: WatchStatus) {
  const list = read();
  const i = list.findIndex((w) => w.userId === status.userId);
  if (i >= 0) list[i] = status;
  else list.push(status);
  write(list);
}
