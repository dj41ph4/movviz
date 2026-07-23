import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "beta-player.json");

interface BetaPlayerConfig {
  enabled: boolean;
  /** Durée de cache en secondes pour les segments vidéo (0 = pas de cache). Défaut: 300s (5 min). */
  streamCacheTtl: number;
}

const DEFAULT: BetaPlayerConfig = { enabled: false, streamCacheTtl: 300 };

function load(): BetaPlayerConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<BetaPlayerConfig>>(FILE, {}) };
}

function save(cfg: BetaPlayerConfig) {
  writeJsonCached(FILE, cfg);
}

export function isBetaPlayerEnabled(): boolean {
  return load().enabled;
}

export function setBetaPlayerEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, enabled });
}

export function getStreamCacheTtl(): number {
  return load().streamCacheTtl;
}

export function setStreamCacheTtl(ttl: number): void {
  const cfg = load();
  save({ ...cfg, streamCacheTtl: Math.max(0, ttl) });
}
