import fs from "node:fs";
import path from "node:path";

/**
 * "Pourquoi Movviz a choisi ça ?" (LOT4.3) — a bounded, disk-persisted
 * journal of automatic-grab decisions (accepted AND rejected), so the engine
 * can explain itself after the fact instead of being a black box. Consumed
 * by Doctor Movviz's "Décisions récentes" (LOT4.4). Same ring-buffer +
 * debounced-write pattern as searchLog.ts/statusTransitions.ts — never a
 * synchronous disk write on a request path.
 */

const MAX_ENTRIES = 300;
const WRITE_COALESCE_MS = 5000;

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "decision-log.json");

export interface DecisionLogEntry {
  t: number;
  refTitle: string;
  releaseTitle: string;
  decision: "accepted" | "rejected";
  reasons: { type: string; message: string }[];
  /** Which grab path produced this decision — optional, absent on older/untagged entries. See GrabIntent in library/types.ts. */
  intent?: "first_acquisition" | "quality_upgrade" | "additional_version";
}

const g = globalThis as typeof globalThis & {
  __movvizDecisionLog?: DecisionLogEntry[];
  __movvizDecisionLogTimer?: ReturnType<typeof setTimeout> | null;
};
const buffer: DecisionLogEntry[] = (g.__movvizDecisionLog ??= []);

function loadFromDisk(): DecisionLogEntry[] {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf8")) as DecisionLogEntry[];
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
    console.error("[decisionLog] failed to persist:", err);
  }
}

function scheduleFlush() {
  if (g.__movvizDecisionLogTimer) clearTimeout(g.__movvizDecisionLogTimer);
  g.__movvizDecisionLogTimer = setTimeout(() => {
    g.__movvizDecisionLogTimer = null;
    flushToDisk();
  }, WRITE_COALESCE_MS);
}

export function recordDecision(entry: Omit<DecisionLogEntry, "t">) {
  buffer.push({ t: Date.now(), ...entry });
  while (buffer.length > MAX_ENTRIES) buffer.shift();
  scheduleFlush();
}

/** Most recent decisions first. */
export function getDecisionLog(limit = 50): DecisionLogEntry[] {
  return [...buffer].reverse().slice(0, limit);
}
