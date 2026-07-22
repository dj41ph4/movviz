import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { Issue } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "issues.json");

function read(): Issue[] {
  return readJsonCached<Issue[]>(FILE, []);
}
function write(list: Issue[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function loadIssues(): Issue[] {
  return read();
}
export function getIssue(id: string): Issue | null {
  return read().find((i) => i.id === id) ?? null;
}
export function addIssue(issue: Issue): Issue {
  const list = read();
  list.push(issue);
  write(list);
  return issue;
}
export function updateIssue(id: string, patch: Partial<Issue>): Issue | null {
  const list = read();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, updatedAt: Date.now() };
  write(list);
  return list[i];
}
/** Danger zone: wipe every issue. */
export function clearIssues() {
  write([]);
}
