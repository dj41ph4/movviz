import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import fs from "node:fs";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const FILE = path.join(CONFIG_DIR, "resolver.json");

export interface ResolverConfig {
  url: string;
}

const defaults: ResolverConfig = {
  url: "http://localhost:9830",
};

export function loadResolverConfig(): ResolverConfig {
  return { ...defaults, ...readJsonCached<Partial<ResolverConfig>>(FILE, {}) };
}

export function saveResolverConfig(config: ResolverConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, config);
}
