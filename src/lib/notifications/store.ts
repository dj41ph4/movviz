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

export function emitNotification(
  kind: NotificationKind,
  message: string,
  href: string | null = null,
  params?: Record<string, string | number>
) {
  const list = readJson<NotificationItem[]>(FILE, []);
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
