import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "scheduler.json");

interface TaskRun {
  lastRunAt: number | null;
  lastDurationMs: number | null;
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

export function getTaskRun(id: string): TaskRun {
  const all = readJson<Record<string, TaskRun>>(FILE, {});
  return all[id] ?? { lastRunAt: null, lastDurationMs: null };
}

export function recordTaskRun(id: string, durationMs: number) {
  const all = readJson<Record<string, TaskRun>>(FILE, {});
  all[id] = { lastRunAt: Date.now(), lastDurationMs: durationMs };
  writeJson(FILE, all);
}
