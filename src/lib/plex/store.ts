import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PlexServerConfig } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex.json");

const DEFAULT: PlexServerConfig = {
  hostname: "",
  port: 32400,
  useSsl: false,
  adminToken: null,
  clientId: "",
  syncLibrary: false,
  watchlistSyncEnabled: true,
  machineIdentifier: null,
};

export function loadPlexConfig(): PlexServerConfig {
  const cfg: PlexServerConfig = {
    ...DEFAULT,
    ...readJsonCached<Partial<PlexServerConfig>>(FILE, {}),
  };
  // Every Plex OAuth request needs a stable client identifier — mint one once and keep it forever.
  if (!cfg.clientId) {
    cfg.clientId = randomUUID();
    savePlexConfig(cfg);
  }
  return cfg;
}

export function savePlexConfig(cfg: PlexServerConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, cfg);
}

export function plexConfigured(): boolean {
  const cfg = loadPlexConfig();
  return !!cfg.hostname && !!cfg.adminToken;
}
