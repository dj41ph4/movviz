import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { SeerrConfig } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "seerr.json");

const DEFAULT: SeerrConfig = { baseUrl: "", apiKey: "" };

export function loadSeerrConfig(): SeerrConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<SeerrConfig>>(FILE, {}) };
}

export function saveSeerrConfig(cfg: SeerrConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}

export function seerrConfigured(): boolean {
  const cfg = loadSeerrConfig();
  return !!cfg.baseUrl && !!cfg.apiKey;
}
