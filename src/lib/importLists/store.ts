import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { ImportListConfig } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "import-lists.json");

function writeJson(data: ImportListConfig[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, data);
}

export function loadImportLists(): ImportListConfig[] {
  return readJsonCached<ImportListConfig[]>(FILE, []);
}

export function saveImportList(cfg: ImportListConfig) {
  const list = loadImportLists();
  const idx = list.findIndex((l) => l.id === cfg.id);
  if (idx >= 0) list[idx] = cfg;
  else list.push(cfg);
  writeJson(list);
}

export function removeImportList(id: string) {
  writeJson(loadImportLists().filter((l) => l.id !== id));
}

export function updateImportListSync(id: string, timestamp: number) {
  const list = loadImportLists();
  const item = list.find((l) => l.id === id);
  if (item) { item.lastSync = timestamp; writeJson(list); }
}
