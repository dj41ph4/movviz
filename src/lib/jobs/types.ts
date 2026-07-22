/** Every background job type Movviz can queue, in the order shown in Settings. */
export const JOB_TYPES = [
  "download",
  "sagaScan",
  "reconcile",
  "qualityUpgrade",
  "plexLibrarySync",
  "plexWatchlistSync",
  "metadataRefresh",
  "rssScan",
  "seerrImport",
  "importLists",
  "libraryIndex",
  "libraryRename",
  "maintenance",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  type: JobType;
  label: string;
  status: JobStatus;
  current: number;
  total: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  /** Dedup key for jobs enqueued from a fixed source (e.g. a scheduled task
   *  id) — several sources can share one JobType, so isTypeActive() alone
   *  can't tell them apart. */
  sourceId?: string;
}
