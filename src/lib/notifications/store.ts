import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { NotificationItem, NotificationKind } from "./types";
import { dispatchNotification } from "./router";
import { eventBus } from "@/lib/events/EventBus";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "notifications.json");
const MAX_KEEP = 200;

function readJson<T>(file: string, fallback: T): T { return readJsonCached(file, fallback); }
function writeJson(file: string, data: unknown) { fs.mkdirSync(CONFIG_DIR, { recursive: true }); writeJsonCached(file, data); }

export function loadNotifications(): NotificationItem[] {
  return readJson<NotificationItem[]>(FILE, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function markAllRead() {
  const list = readJson<NotificationItem[]>(FILE, []).map((n) => ({ ...n, read: true }));
  writeJson(FILE, list);
}

export function clearNotifications() { writeJson(FILE, []); }

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1h

function sameParams(a: Record<string, string | number> | undefined, b: Record<string, string | number> | undefined): boolean {
  const ae = Object.entries(a ?? {});
  const be = Object.entries(b ?? {});
  if (ae.length !== be.length) return false;
  return ae.every(([k, v]) => (b ?? {})[k] === v);
}

export function emitNotification(
  kind: NotificationKind,
  message: string,
  href: string | null = null,
  params?: Record<string, string | number>
) {
  const list = readJson<NotificationItem[]>(FILE, []);
  // A scheduled job re-scanning already-imported content (e.g. leftover files
  // it can't clean up) would otherwise re-emit the exact same event every
  // run — confirmed live: the same "season available" notification firing
  // every ~30min for content that had been available for a week. Same
  // kind+params within a short window is treated as the same real-world
  // event, not a new one; a genuine repeat far later (days) still gets through.
  const recentDuplicate = list.find(
    (n) => n.kind === kind && sameParams(n.params, params) && Date.now() - n.createdAt < DEDUP_WINDOW_MS
  );
  if (recentDuplicate) return recentDuplicate;

  const item: NotificationItem = {
    id: `nt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind, message, params, href, read: false, createdAt: Date.now(),
  };
  list.unshift(item);
  writeJson(FILE, list.slice(0, MAX_KEEP));
  dispatchNotification(message).catch(() => {});
  eventBus.emit({ type: "notification_added" });
  return item;
}
