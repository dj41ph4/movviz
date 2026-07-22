import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { NotificationTransportConfig } from "./types";
import { DEFAULT_TRANSPORT_CONFIG } from "./types";

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "notification-transports.json");

export function loadTransportConfig(): NotificationTransportConfig {
  return readJsonCached<NotificationTransportConfig>(FILE, DEFAULT_TRANSPORT_CONFIG);
}

export function saveTransportConfig(cfg: NotificationTransportConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}
