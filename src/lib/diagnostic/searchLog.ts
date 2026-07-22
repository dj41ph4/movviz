import fs from "node:fs";
import path from "node:path";

const MAX_LINES = 2000;
const WRITE_COALESCE_MS = 5000;

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const FILE = path.join(CONFIG_DIR, "search-diagnostic-log.json");

export interface SearchLogLine {
  t: number;
  level: "info" | "warn" | "error" | "debug";
  step: string;
  message: string;
  ms?: number;
}

const g = globalThis as typeof globalThis & {
  __movvizSearchLog?: SearchLogLine[];
  __movvizSearchLogTimer?: ReturnType<typeof setTimeout> | null;
};
const buffer: SearchLogLine[] = (g.__movvizSearchLog ??= []);

function loadFromDisk(): SearchLogLine[] {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf8");
      return JSON.parse(raw) as SearchLogLine[];
    }
  } catch {
    // corrupt or missing file — start fresh
  }
  return [];
}

// Pre-populate buffer from disk at module init
if (buffer.length === 0) {
  const persisted = loadFromDisk();
  for (const line of persisted) buffer.push(line);
}

function flushToDisk() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(buffer), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("[searchLog] failed to persist:", err);
  }
}

function scheduleFlush() {
  if (g.__movvizSearchLogTimer) clearTimeout(g.__movvizSearchLogTimer);
  g.__movvizSearchLogTimer = setTimeout(() => {
    g.__movvizSearchLogTimer = null;
    flushToDisk();
  }, WRITE_COALESCE_MS);
}

export function recordSearchLog(level: SearchLogLine["level"], step: string, message: string, ms?: number) {
  buffer.push({ t: Date.now(), level, step, message, ms });
  while (buffer.length > MAX_LINES) buffer.shift();
  scheduleFlush();
}

export function getSearchLog(): SearchLogLine[] {
  return [...buffer];
}

export function clearSearchLog() {
  buffer.length = 0;
  if (g.__movvizSearchLogTimer) {
    clearTimeout(g.__movvizSearchLogTimer);
    g.__movvizSearchLogTimer = null;
  }
  try {
    if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  } catch {
    // ignore
  }
}
