import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "scrub-sprites.json");

/**
 * Aperçus de la barre de progression générés par Movviz (ffmpeg) pour les
 * fichiers que Plex n'a pas préparés. Activé par défaut : la génération est
 * légère (un saut par vignette, un seul thread, priorité basse, jamais
 * pendant une lecture) et ne touche que les fichiers sans aperçu Plex.
 */
export function isScrubSpritesEnabled(): boolean {
  return readJsonCached<{ enabled?: boolean }>(FILE, {}).enabled ?? true;
}

export function setScrubSpritesEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled: !!enabled });
}
