import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { BlockedTitle } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "blocklist.json");

function read(): BlockedTitle[] {
  return readJsonCached<BlockedTitle[]>(FILE, []);
}
function write(list: BlockedTitle[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function loadBlocklist(): BlockedTitle[] {
  return read();
}

export function isBlocked(type: "movie" | "series", tmdbId: number): boolean {
  return read().some((b) => b.type === type && b.tmdbId === tmdbId);
}

export function addToBlocklist(entry: BlockedTitle): BlockedTitle {
  const list = read();
  if (list.some((b) => b.type === entry.type && b.tmdbId === entry.tmdbId)) return entry;
  list.push(entry);
  write(list);
  return entry;
}

export function removeFromBlocklist(id: string) {
  write(read().filter((b) => b.id !== id));
}
