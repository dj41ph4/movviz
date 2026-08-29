import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "card-trailer-zoom.json");

interface CardTrailerZoomConfig {
  offset: number;
}

const DEFAULT: CardTrailerZoomConfig = { offset: 0 };

function load(): CardTrailerZoomConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<CardTrailerZoomConfig>>(FILE, {}) };
}

function save(cfg: CardTrailerZoomConfig) {
  writeJsonCached(FILE, cfg);
}

export function getCardTrailerZoomConfig(): CardTrailerZoomConfig {
  return load();
}

export function setCardTrailerZoomOffset(offset: number): CardTrailerZoomConfig {
  const safe = Math.max(-100, Math.min(100, Math.round(offset)));
  const cfg = { offset: safe };
  save(cfg);
  return cfg;
}
