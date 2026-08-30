import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "trailer-sources.json");

interface TrailerSourcesConfig {
  enabled: boolean;
}

const DEFAULT: TrailerSourcesConfig = { enabled: false };

function load(): TrailerSourcesConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<TrailerSourcesConfig>>(FILE, {}) };
}

/** Global, admin-only server switch — confirmed live this must NOT be a
 *  per-user preference ("si je l'active c'est actif pour tous"), unlike the
 *  Beta Player's admin-gate-plus-personal-opt-in shape. One flag, one
 *  source of truth, every user sees the same behavior. */
export function isEnhancedTrailerSourcesEnabled(): boolean {
  return load().enabled;
}

export function setEnhancedTrailerSourcesEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled });
}
