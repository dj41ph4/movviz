import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "auto-update.json");

interface AutoUpdateConfig {
  enabled: boolean;
}

const DEFAULT: AutoUpdateConfig = { enabled: true };

function load(): AutoUpdateConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<AutoUpdateConfig>>(FILE, {}) };
}

function save(cfg: AutoUpdateConfig) {
  writeJsonCached(FILE, cfg);
}

export function isAutoUpdateEnabled(): boolean {
  return load().enabled;
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, enabled });
}