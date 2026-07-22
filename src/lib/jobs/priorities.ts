import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { JOB_TYPES, type JobType } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "job-priorities.json");

/**
 * Higher runs first when several jobs are queued at once. `download` isn't
 * dispatched through this queue (torrents are handled by the engine
 * process) — its point value instead throttles how many background job
 * slots stay open while a download is active, so heavy library scans back
 * off in favor of active downloads instead of competing with them for CPU
 * and network I/O.
 */
export const DEFAULT_PRIORITIES: Record<JobType, number> = {
  download: 100,
  qualityUpgrade: 70,
  reconcile: 60,
  plexWatchlistSync: 55,
  plexLibrarySync: 50,
  rssScan: 45,
  seerrImport: 40,
  importLists: 40,
  metadataRefresh: 30,
  sagaScan: 20,
  libraryIndex: 20,
  libraryRename: 20,
  maintenance: 15,
};

export function getPriorities(): Record<JobType, number> {
  const stored = readJsonCached<Partial<Record<JobType, number>>>(FILE, {});
  const merged = { ...DEFAULT_PRIORITIES, ...stored };
  // Drop anything from an older/renamed type set instead of surfacing stale keys.
  const result = {} as Record<JobType, number>;
  for (const type of JOB_TYPES) result[type] = merged[type] ?? DEFAULT_PRIORITIES[type];
  return result;
}

export function setPriorities(patch: Partial<Record<JobType, number>>): Record<JobType, number> {
  const current = getPriorities();
  for (const type of JOB_TYPES) {
    const v = patch[type];
    if (typeof v === "number" && Number.isFinite(v)) current[type] = Math.max(0, Math.min(100, Math.round(v)));
  }
  writeJsonCached(FILE, current);
  return current;
}

export function priorityOf(type: JobType): number {
  return getPriorities()[type] ?? 0;
}
