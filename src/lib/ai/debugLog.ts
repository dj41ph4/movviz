import fs from "node:fs";
import path from "node:path";

/**
 * "Pourquoi l'IA a répondu ça ?" — a bounded, disk-persisted journal of chat
 * calls (provider used, success/failure, latency, action taken), so the
 * admin settings panel can explain what the assistant has actually been
 * doing instead of it being a black box. Same ring-buffer + debounced-write
 * pattern as decisionLog.ts/searchLog.ts — never a synchronous disk write on
 * a request path. Never stores API keys or full message bodies — see
 * `preview` (truncated, no system prompt/context).
 */

const MAX_ENTRIES = 200;
const WRITE_COALESCE_MS = 5000;
const PREVIEW_MAX_LEN = 160;

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-debug-log.json");

export interface AiDebugEntry {
  t: number;
  username: string;
  /** What the assistant decided to do with this message. */
  kind: "chat" | "add_media" | "recommend";
  provider: string | null;
  success: boolean;
  durationMs: number;
  error?: string;
  /** Resolved item count for add_media/recommend, absent for plain chat. */
  itemCount?: number;
  /** Truncated user message — never the system prompt or full context. */
  preview: string;
}

const g = globalThis as typeof globalThis & {
  __movvizAiDebugLog?: AiDebugEntry[];
  __movvizAiDebugLogTimer?: ReturnType<typeof setTimeout> | null;
};
const buffer: AiDebugEntry[] = (g.__movvizAiDebugLog ??= []);

function loadFromDisk(): AiDebugEntry[] {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf8")) as AiDebugEntry[];
  } catch {
    // corrupt or missing file — start fresh
  }
  return [];
}

if (buffer.length === 0) {
  for (const entry of loadFromDisk()) buffer.push(entry);
}

function flushToDisk() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(buffer), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("[ai debugLog] failed to persist:", err);
  }
}

function scheduleFlush() {
  if (g.__movvizAiDebugLogTimer) clearTimeout(g.__movvizAiDebugLogTimer);
  g.__movvizAiDebugLogTimer = setTimeout(() => {
    g.__movvizAiDebugLogTimer = null;
    flushToDisk();
  }, WRITE_COALESCE_MS);
}

export function recordAiCall(entry: Omit<AiDebugEntry, "t" | "preview"> & { message: string }) {
  const { message, ...rest } = entry;
  const preview = message.length > PREVIEW_MAX_LEN ? `${message.slice(0, PREVIEW_MAX_LEN)}…` : message;
  buffer.push({ t: Date.now(), preview, ...rest });
  while (buffer.length > MAX_ENTRIES) buffer.shift();
  scheduleFlush();
}

/** Most recent calls first. */
export function getAiDebugLog(limit = 100): AiDebugEntry[] {
  return [...buffer].reverse().slice(0, limit);
}

export function clearAiDebugLog(): void {
  buffer.length = 0;
  scheduleFlush();
}
