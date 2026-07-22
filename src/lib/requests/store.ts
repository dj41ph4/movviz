import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { MediaRequest } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "requests.json");

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

export function loadRequests(): MediaRequest[] {
  return readJson<MediaRequest[]>(FILE, []);
}
function saveRequests(list: MediaRequest[]) {
  writeJson(FILE, list);
}
export function getRequest(id: string): MediaRequest | null {
  return loadRequests().find((r) => r.id === id) ?? null;
}
export function addRequest(request: MediaRequest): MediaRequest {
  const list = loadRequests();
  list.push(request);
  saveRequests(list);
  return request;
}
export function updateRequest(id: string, patch: Partial<MediaRequest>): MediaRequest | null {
  const list = loadRequests();
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveRequests(list);
  return list[i];
}
/** Danger zone: wipe every request. */
export function clearRequests() {
  saveRequests([]);
}
