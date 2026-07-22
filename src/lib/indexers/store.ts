import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { ConfiguredIndexer } from "./types";

/**
 * Server-side persistence for configured indexers. Stored as JSON in the data
 * directory (shared with the engine). API keys live here — flagged for
 * at-rest encryption as a follow-up; today it is loopback + local only.
 */

// Indexer config lives with the app config, not the media root.
const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "indexers.json");

export function loadIndexers(): ConfiguredIndexer[] {
  return readJsonCached<ConfiguredIndexer[]>(FILE, []);
}

function save(list: ConfiguredIndexer[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function addIndexer(ix: ConfiguredIndexer) {
  const list = loadIndexers();
  list.push(ix);
  save(list);
  return ix;
}

export function removeIndexer(id: string) {
  const list = loadIndexers().filter((i) => i.id !== id);
  save(list);
}

export function updateIndexer(id: string, patch: Partial<ConfiguredIndexer>) {
  const list = loadIndexers();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  save(list);
  return list[i];
}

export function getIndexer(id: string) {
  return loadIndexers().find((i) => i.id === id) ?? null;
}

/** Never leak credentials to the browser. */
export function redact(ix: ConfiguredIndexer) {
  const { apiKey, username, password, ...rest } = ix;
  return {
    ...rest,
    hasApiKey: !!apiKey,
    hasCredentials: !!(username && password),
    username: username ? username : undefined, // username alone is not secret, safe to show
  };
}
