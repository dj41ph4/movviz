import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const CONFIG_FILE = path.join(CONFIG_DIR, "trash-config.json");
const MANIFEST_FILE = path.join(CONFIG_DIR, "trash-manifest.json");

export interface TrashConfig {
  /** Root folder movies get moved into on delete. null = trash disabled for movies (old immediate-delete behavior). */
  moviesPath: string | null;
  seriesPath: string | null;
  /** Days a trashed item stays before the daily purge task permanently deletes it. */
  retentionDays: number;
}

const DEFAULT_CONFIG: TrashConfig = { moviesPath: null, seriesPath: null, retentionDays: 30 };

export function getTrashConfig(): TrashConfig {
  return { ...DEFAULT_CONFIG, ...readJsonCached<Partial<TrashConfig>>(CONFIG_FILE, {}) };
}

export function setTrashConfig(patch: Partial<TrashConfig>): TrashConfig {
  const next = { ...getTrashConfig(), ...patch };
  writeJsonCached(CONFIG_FILE, next);
  return next;
}

export interface TrashEntry {
  id: string;
  kind: "movie" | "series";
  title: string;
  trashPath: string;
  deletedAt: number;
}

export function loadTrashManifest(): TrashEntry[] {
  return readJsonCached<TrashEntry[]>(MANIFEST_FILE, []);
}

export function addTrashEntry(entry: TrashEntry): void {
  const list = loadTrashManifest();
  list.push(entry);
  writeJsonCached(MANIFEST_FILE, list);
}

export function removeTrashEntry(id: string): void {
  writeJsonCached(MANIFEST_FILE, loadTrashManifest().filter((e) => e.id !== id));
}

/** Every configured trash root — used to keep reconcile/indexing scans from ever treating a trashed file as a "new" or "untracked" one. */
export function trashRoots(): string[] {
  const cfg = getTrashConfig();
  return [cfg.moviesPath, cfg.seriesPath].filter((p): p is string => !!p).map((p) => path.normalize(p));
}
