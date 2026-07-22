import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "webhook.json");

export interface WebhookConfig {
  enabled: boolean;
  url: string;
}

const DEFAULT: WebhookConfig = { enabled: false, url: "" };

export function loadWebhook(): WebhookConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<WebhookConfig>>(FILE, {}) };
}

export function saveWebhook(cfg: WebhookConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}
