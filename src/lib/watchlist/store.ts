import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { WatchlistItem } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "watchlist.json");

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

export function loadWatchlist(userId: string): WatchlistItem[] {
  return readJson<WatchlistItem[]>(FILE, []).filter((i) => i.userId === userId);
}
export function addWatchlistItem(item: WatchlistItem) {
  const all = readJson<WatchlistItem[]>(FILE, []);
  if (all.some((i) => i.userId === item.userId && i.type === item.type && i.tmdbId === item.tmdbId)) return item;
  all.push(item);
  writeJson(FILE, all);
  return item;
}
export function removeWatchlistItem(userId: string, type: string, tmdbId: number) {
  const all = readJson<WatchlistItem[]>(FILE, []);
  writeJson(FILE, all.filter((i) => !(i.userId === userId && i.type === type && i.tmdbId === tmdbId)));
}
