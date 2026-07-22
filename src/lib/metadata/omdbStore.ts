import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "omdb.json");

interface OmdbConfig {
  apiKey: string | null;
}

const DEFAULT: OmdbConfig = { apiKey: null };

export function loadOmdbConfig(): OmdbConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<OmdbConfig>>(FILE, {}) };
}

export function saveOmdbConfig(cfg: OmdbConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}
