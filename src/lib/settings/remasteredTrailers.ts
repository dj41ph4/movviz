import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "remastered-trailers.json");

interface RemasteredTrailersConfig {
  enabled: boolean;
}

const DEFAULT: RemasteredTrailersConfig = { enabled: false };

function load(): RemasteredTrailersConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<RemasteredTrailersConfig>>(FILE, {}) };
}

/** Global, admin-only server switch — same shape as trailerSources but isolated file. */
export function isRemasteredTrailersEnabled(): boolean {
  return load().enabled;
}

export function setRemasteredTrailersEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled });
}
