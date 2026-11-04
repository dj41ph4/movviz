import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { JobType } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "background-tasks.json");
/** Ancien réglage « points de priorité » : seule sa valeur « download » est encore lue, une fois, pour migrer. */
const LEGACY_FILE = path.join(CONFIG_DIR, "job-priorities.json");

/**
 * Ordre de passage des tâches planifiées quand plusieurs attendent en même
 * temps (surtout juste après un redémarrage) : le plus grand passe d'abord.
 * Valeurs FIXES — l'ancien réglage par curseurs a été retiré : la protection
 * du serveur vient des tâches lourdes une par une, de l'attente pendant
 * l'usage et la lecture, et des voies de priorité des requêtes. Ce classement
 * ne fait que départager des tâches déjà autorisées à démarrer.
 *
 * Les actions de l'utilisateur passent toujours devant (voir queue.ts).
 */
const JOB_ORDER: Record<JobType, number> = {
  download: 100,
  qualityUpgrade: 11,
  reconcile: 60,
  plexWatchlistSync: 55,
  plexLibrarySync: 50,
  plexMarkerSync: 50,
  rssScan: 58,
  seerrImport: 40,
  importLists: 40,
  metadataRefresh: 30,
  sagaScan: 20,
  libraryIndex: 20,
  libraryRename: 20,
  maintenance: 15,
  mediaProbe: 15,
};

export function priorityOf(type: JobType): number {
  return JOB_ORDER[type] ?? 0;
}

/**
 * Pendant un téléchargement actif, les tâches de fond se limitent à 2 en
 * parallèle pour lui laisser la place. Activé par défaut. Une installation
 * qui avait baissé l'ancien curseur « Téléchargements » sous 50 garde son
 * choix : désactivé.
 */
export function isBackgroundSlowedDuringDownload(): boolean {
  const stored = readJsonCached<{ slowDuringDownload?: unknown }>(FILE, {}).slowDuringDownload;
  if (typeof stored === "boolean") return stored;
  const legacy = readJsonCached<{ download?: unknown }>(LEGACY_FILE, {}).download;
  return typeof legacy === "number" ? legacy >= 50 : true;
}

export function setBackgroundSlowedDuringDownload(enabled: boolean): void {
  writeJsonCached(FILE, { slowDuringDownload: !!enabled });
}
