import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { EngineConfig } from "@/lib/playback/types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "beta-player.json");

interface BetaPlayerConfig {
  enabled: boolean;
  /** Durée de cache en secondes pour les segments vidéo (0 = pas de cache). Défaut: 300s (5 min). */
  streamCacheTtl: number;
  /**
   * Autorise uniquement le tonemapping HDR/Dolby Vision vers SDR. Même activé,
   * le planner garde son seuil de sécurité benchmark >= 3×. Désactivé = aucune
   * conversion HDR10/HDR10+/HLG/Dolby Vision vers SDR, sur aucun client.
   */
  hdrDvToSdrEnabled: boolean;
  /** Automatic engine; old persisted values are ignored for compatibility. */
  playbackEngine: EngineConfig;
  /** Affiche le panneau debug playback (mode, codecs, buffer, réseau...). */
  debug: boolean;
  /** Posé une fois la migration ponctuelle Stable/Auto/Beta effectuée — voir load(). */
  engineTierMigrated?: boolean;
  unifiedPlayerMigrated?: boolean;
}

const DEFAULT: BetaPlayerConfig = {
  enabled: true,
  streamCacheTtl: 300,
  hdrDvToSdrEnabled: true,
  playbackEngine: "auto",
  debug: false,
  engineTierMigrated: true,
  unifiedPlayerMigrated: true,
};

/** Preserve the one-time migrations of legacy installations. */
function load(): BetaPlayerConfig {
  const raw = readJsonCached<Partial<BetaPlayerConfig>>(FILE, {});
  const cfg = { ...DEFAULT, ...raw };
  if (!raw.engineTierMigrated) {
    cfg.playbackEngine = "auto";
    cfg.engineTierMigrated = true;
  }
  if (!raw.unifiedPlayerMigrated) {
    cfg.enabled = true;
    cfg.playbackEngine = "auto";
    cfg.unifiedPlayerMigrated = true;
    save(cfg);
  }
  return cfg;
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

export function isHdrDvToSdrEnabled(): boolean {
  return load().hdrDvToSdrEnabled;
}

export function setHdrDvToSdrEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, hdrDvToSdrEnabled: !!enabled });
}

export function getPlaybackEngine(): EngineConfig {
  return "auto";
}

export function isPlaybackDebugEnabled(): boolean {
  return load().debug;
}

export function setPlaybackDebugEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, debug: !!enabled });
}
