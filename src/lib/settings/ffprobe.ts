import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ffprobe.json");

interface FfprobeConfig {
  enabled: boolean;
}

/**
 * Désactivé par défaut, y compris sur les serveurs existants (aucun fichier =
 * désactivé) : tant que l'analyse ffprobe de fichiers incomplets n'est pas
 * résolue, Movviz s'appuie sur Plex pour les pistes et le lecteur.
 */
const DEFAULT: FfprobeConfig = { enabled: false };

export function isFfprobeEnabled(): boolean {
  return readJsonCached<Partial<FfprobeConfig>>(FILE, {}).enabled ?? DEFAULT.enabled;
}

export function setFfprobeEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled: !!enabled });
}
