import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * « Effacer la lecture » d'un profil : date à partir de laquelle le
 * visionnage de CE profil repart de zéro. Tout événement « vu »/lecture daté
 * d'avant (une resynchro de l'historique Plex, un rattrapage legacy, une
 * reprise Plex restée en place) est ignoré, sinon les vues effacées
 * reviendraient à la synchro suivante. Un import explicite (Netflix) reste
 * accepté : c'est l'utilisateur qui le relance après l'effacement.
 *
 * Fichier JSON plutôt que SQLite : le garde-fou doit tenir aussi quand le
 * moteur de contexte est indisponible (voir applyWatchDecision).
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "watch-reset.json");

export type WatchResetPlexState = "running" | "done" | "partial" | "skipped" | "failed";

export interface WatchResetRecord {
  resetAt: number;
  plex?: {
    state: WatchResetPlexState;
    /** Raison lisible quand Plex n'a pas pu être (entièrement) effacé. */
    reason?: string;
    cleared?: number;
    remaining?: number;
    finishedAt?: number;
  };
}

type Store = Record<string, WatchResetRecord>;

function read(): Store {
  return readJsonCached<Store>(FILE, {});
}

export function getWatchReset(userId: string): WatchResetRecord | null {
  return read()[userId] ?? null;
}

/** Date de remise à zéro du profil, null s'il n'a jamais été effacé. */
export function getWatchResetFloor(userId: string): number | null {
  const at = read()[userId]?.resetAt;
  return typeof at === "number" && Number.isFinite(at) ? at : null;
}

/** Vrai quand un événement daté `at` précède la remise à zéro du profil. */
export function isBeforeWatchReset(userId: string, at: number | null | undefined): boolean {
  const floor = getWatchResetFloor(userId);
  if (floor == null) return false;
  return at == null || !Number.isFinite(at) || at < floor;
}

export function setWatchReset(userId: string, record: WatchResetRecord): void {
  const store = { ...read(), [userId]: record };
  writeJsonCached(FILE, store);
}

export function updateWatchResetPlex(userId: string, plex: NonNullable<WatchResetRecord["plex"]>): void {
  const current = read()[userId];
  if (!current) return;
  setWatchReset(userId, { ...current, plex });
}
