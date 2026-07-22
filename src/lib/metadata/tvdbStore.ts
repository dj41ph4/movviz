import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "tvdb.json");

interface TvdbConfig {
  apiKey: string | null;
  useForAnime: boolean;
}

const DEFAULT: TvdbConfig = { apiKey: null, useForAnime: false };

export function loadTvdbConfig(): TvdbConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<TvdbConfig>>(FILE, {}) };
}

export function saveTvdbConfig(cfg: TvdbConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}
