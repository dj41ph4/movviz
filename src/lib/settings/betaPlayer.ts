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
   * Moteur de lecture : "auto" (décision automatique, MSE pour les MP4
   * compatibles, ffmpeg local pour MKV/non-MP4 si disponible), "native"
   * (moteurs existants uniquement), "mse" (tente MSE en priorité, fallback
   * automatique), "ffmpeg" (tente le remux local en priorité). Défaut: "auto".
   */
  playbackEngine: EngineConfig;
  /** Affiche le panneau debug playback (mode, codecs, buffer, réseau...). */
  debug: boolean;
}

const DEFAULT: BetaPlayerConfig = {
  enabled: false,
  streamCacheTtl: 300,
  playbackEngine: "auto",
  debug: false,
};

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

export function getPlaybackEngine(): EngineConfig {
  const v = load().playbackEngine;
  return v === "native" || v === "mse" || v === "ffmpeg" ? v : "auto";
}

export function setPlaybackEngine(engine: EngineConfig): void {
  const cfg = load();
  save({ ...cfg, playbackEngine: engine === "native" || engine === "mse" || engine === "ffmpeg" ? engine : "auto" });
}

export function isPlaybackDebugEnabled(): boolean {
  return load().debug;
}

export function setPlaybackDebugEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, debug: !!enabled });
}
