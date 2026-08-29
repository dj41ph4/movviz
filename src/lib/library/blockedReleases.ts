import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "blocked-releases.json");

export interface BlockedRelease {
  infoHash: string;
  releaseTitle: string;
  mediaTitle: string;
  indexer: string;
  blockedAt: number;
  blockedBy: string;
}

function read(): BlockedRelease[] {
  return readJsonCached<BlockedRelease[]>(FILE, []);
}

export function loadBlockedReleases(): BlockedRelease[] {
  return read().sort((a, b) => b.blockedAt - a.blockedAt);
}

export function isBlockedRelease(infoHash: string | null | undefined): boolean {
  if (!infoHash) return false;
  const normalized = infoHash.toLowerCase();
  return read().some((release) => release.infoHash === normalized);
}

export function blockRelease(release: Omit<BlockedRelease, "infoHash" | "blockedAt"> & { infoHash: string }): BlockedRelease | null {
  const infoHash = release.infoHash.trim().toLowerCase();
  if (!/^[a-f0-9]{40,64}$/i.test(infoHash)) return null;
  const current = read().filter((item) => item.infoHash !== infoHash);
  const record: BlockedRelease = { ...release, infoHash, blockedAt: Date.now() };
  current.push(record);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, current);
  return record;
}

export function unblockRelease(infoHash: string): boolean {
  const normalized = infoHash.trim().toLowerCase();
  const current = read();
  const next = current.filter((item) => item.infoHash !== normalized);
  if (next.length === current.length) return false;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, next);
  return true;
}
