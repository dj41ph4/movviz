import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "cdn-images.json");

interface CdnImagesConfig {
  /** Posters/backdrops/logos load from TMDb's own CDN instead of Movviz's
   *  same-origin NAS-backed cache. A server-wide bandwidth/load decision —
   *  previously a per-user opt-in, moved here (2026-08) since one admin's
   *  reason for wanting it (or not) applies to the whole household's
   *  connection/NAS, not to any one account individually. */
  enabled: boolean;
  /** Only meaningful alongside `enabled` — stay on the same-origin route when
   *  the request is detected as coming from the local network. */
  localNetworkPriorityEnabled: boolean;
}

const DEFAULT: CdnImagesConfig = { enabled: false, localNetworkPriorityEnabled: true };

function load(): CdnImagesConfig {
  return { ...DEFAULT, ...readJsonCached<Partial<CdnImagesConfig>>(FILE, {}) };
}

function save(cfg: CdnImagesConfig) {
  writeJsonCached(FILE, cfg);
}

export function getCdnImagesConfig(): CdnImagesConfig {
  return load();
}

export function setCdnImagesEnabled(enabled: boolean): CdnImagesConfig {
  const cfg = { ...load(), enabled: !!enabled };
  save(cfg);
  return cfg;
}

export function setLocalNetworkPriorityEnabled(enabled: boolean): CdnImagesConfig {
  const cfg = { ...load(), localNetworkPriorityEnabled: !!enabled };
  save(cfg);
  return cfg;
}
