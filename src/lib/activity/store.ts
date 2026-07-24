import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { ActivityDetails, ActivityEntry, ActivityKind } from "./types";
import { eventBus } from "@/lib/events/EventBus";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "activity.json");
const MAX_KEEP = 500;

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

export function loadActivity(): ActivityEntry[] {
  return readJson<ActivityEntry[]>(FILE, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function logActivity(
  kind: ActivityKind,
  actor: string,
  subject: string,
  href: string | null = null,
  details?: ActivityDetails,
) {
  const list = readJson<ActivityEntry[]>(FILE, []);
  const entry: ActivityEntry = {
    id: `ac_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind,
    actor,
    subject,
    href,
    createdAt: Date.now(),
    details,
  };
  list.unshift(entry);
  writeJson(FILE, list.slice(0, MAX_KEEP));
  eventBus.emit({ type: "activity_updated" });
  return entry;
}

/** Danger zone: wipe the activity log. */
export function clearActivity() {
  writeJson(FILE, []);
}
