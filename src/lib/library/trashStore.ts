import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const CONFIG_FILE = path.join(CONFIG_DIR, "trash-config.json");
const MANIFEST_FILE = path.join(CONFIG_DIR, "trash-manifest.json");
const TRASH_FILE = path.join(CONFIG_DIR, "library-trash.json");

// ── Config disque (corbeille fichiers) ──

export interface TrashConfig {
  moviesPath: string | null;
  seriesPath: string | null;
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

export function trashRoots(): string[] {
  const cfg = getTrashConfig();
  return [cfg.moviesPath, cfg.seriesPath].filter((p): p is string => !!p).map((p) => path.normalize(p));
}

// ── Corbeille métadonnées (soft-delete bibliothèque) ──

export interface TrashItem {
  id: string;
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  rating: number;
  overview: string;
  deletedAt: number;
}

function loadTrashRaw(): TrashItem[] {
  return readJsonCached<TrashItem[]>(TRASH_FILE, []);
}

function saveTrashRaw(list: TrashItem[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(TRASH_FILE, list);
}

export function loadTrash(): TrashItem[] {
  return loadTrashRaw();
}

export function addToTrash(item: TrashItem) {
  const list = loadTrashRaw();
  if (list.some((t) => t.tmdbId === item.tmdbId && t.type === item.type)) return;
  list.push(item);
  saveTrashRaw(list);
}

export function restoreFromTrash(tmdbId: number, type: "movie" | "series"): TrashItem | null {
  const list = loadTrashRaw();
  const idx = list.findIndex((t) => t.tmdbId === tmdbId && t.type === type);
  if (idx < 0) return null;
  const item = list[idx];
  list.splice(idx, 1);
  saveTrashRaw(list);
  return item;
}

export function removeTrashItem(tmdbId: number, type: "movie" | "series") {
  const list = loadTrashRaw();
  const idx = list.findIndex((t) => t.tmdbId === tmdbId && t.type === type);
  if (idx < 0) return;
  list.splice(idx, 1);
  saveTrashRaw(list);
}

export function clearTrash() {
  saveTrashRaw([]);
}
