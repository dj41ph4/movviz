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
   * Moteur de lecture : "auto" (décision automatique — alias de "stable"
   * aujourd'hui, repointable plus tard), "stable" (fige le comportement
   * actuel d'"auto", ne change jamais même si "auto" est repointé), "native"
   * (moteurs existants uniquement), "mse" (tente MSE en priorité, fallback
   * automatique), "ffmpeg" (tente le remux local en priorité), "beta"
   * (moteur decidePlayback() explicitement). Défaut: "auto".
   */
  playbackEngine: EngineConfig;
  /** Affiche le panneau debug playback (mode, codecs, buffer, réseau...). */
  debug: boolean;
  /** Posé une fois la migration ponctuelle Stable/Auto/Beta effectuée — voir load(). */
  engineTierMigrated?: boolean;
}

const DEFAULT: BetaPlayerConfig = {
  enabled: false,
  streamCacheTtl: 300,
  playbackEngine: "auto",
  debug: false,
  engineTierMigrated: true,
};

/**
 * Migration ponctuelle (une seule fois, à cette version précise) : introduire
 * "stable"/"beta" renomme "engine-v2" en "beta" et n'a plus le même sens
 * qu'avant — quiconque avait sélectionné "engine-v2" manuellement en pensant
 * (à raison, jusqu'ici) "ça ne fait rien, c'est un stub expérimental" se
 * retrouverait sinon silencieusement sur le moteur réel. Un fichier existant
 * sans `engineTierMigrated` est réinitialisé sur "auto" une fois, puis le
 * flag est écrit — jamais répété ensuite, même si l'utilisateur change à
 * nouveau son choix plus tard. Une install neuve n'a jamais besoin de ce
 * chemin : DEFAULT porte déjà le flag à true.
 */
function load(): BetaPlayerConfig {
  const raw = readJsonCached<Partial<BetaPlayerConfig>>(FILE, {});
  const cfg = { ...DEFAULT, ...raw };
  if (!raw.engineTierMigrated) {
    cfg.playbackEngine = "auto";
    cfg.engineTierMigrated = true;
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

function isKnownEngine(v: unknown): v is EngineConfig {
  return v === "auto" || v === "stable" || v === "native" || v === "mse" || v === "ffmpeg" || v === "hls" || v === "beta";
}

export function getPlaybackEngine(): EngineConfig {
  const v = load().playbackEngine;
  return isKnownEngine(v) ? v : "auto";
}

export function setPlaybackEngine(engine: EngineConfig): void {
  const cfg = load();
  save({ ...cfg, playbackEngine: isKnownEngine(engine) ? engine : "auto" });
}

export function isPlaybackDebugEnabled(): boolean {
  return load().debug;
}

export function setPlaybackDebugEnabled(enabled: boolean): void {
  const cfg = load();
  save({ ...cfg, debug: !!enabled });
}
