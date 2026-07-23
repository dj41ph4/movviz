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

export interface TaskConfig {
  /** Custom interval override (ms). null = use hardcoded default. */
  intervalMs: number | null;
}

interface SchedulerData {
  runs: Record<string, TaskRun>;
  configs: Record<string, TaskConfig>;
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

function loadData(): SchedulerData {
  const raw = readJson<Record<string, unknown> | null>(FILE, null);
  if (raw == null) return { runs: {}, configs: {} };
  // Migrate from the old flat format (v1.1.x) where the file was
  // { taskId: TaskRun, ... } instead of { runs: { ... }, configs: { ... } }.
  if (!("runs" in raw)) {
    const migrated: SchedulerData = { runs: raw as Record<string, TaskRun>, configs: {} };
    saveData(migrated);
    return migrated;
  }
  return raw as unknown as SchedulerData;
}

function saveData(data: SchedulerData) {
  writeJson(FILE, data);
}

export function getTaskRun(id: string): TaskRun {
  return loadData().runs[id] ?? { lastRunAt: null, lastDurationMs: null };
}

export function recordTaskRun(id: string, durationMs: number) {
  const data = loadData();
  data.runs[id] = { lastRunAt: Date.now(), lastDurationMs: durationMs };
  saveData(data);
}

export function getTaskConfig(id: string): TaskConfig {
  return loadData().configs[id] ?? { intervalMs: null };
}

export function updateTaskConfig(id: string, cfg: Partial<TaskConfig>) {
  const data = loadData();
  const existing = data.configs[id] ?? { intervalMs: null };
  data.configs[id] = { ...existing, ...cfg };
  saveData(data);
}
