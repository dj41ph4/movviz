import { TASKS } from "./tasks";
import { getTaskRun, recordTaskRun } from "./state";
import { enqueueJob, isSourceActive } from "@/lib/jobs/queue";
import type { JobType } from "@/lib/jobs/types";

export interface TaskStatus {
  id: string;
  name: string;
  intervalMs: number;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  nextRunAt: number | null;
}

export function listTaskStatus(): TaskStatus[] {
  return TASKS.map((t) => {
    const run = getTaskRun(t.id);
    return {
      id: t.id,
      name: t.name,
      intervalMs: t.intervalMs,
      lastRunAt: run.lastRunAt,
      lastDurationMs: run.lastDurationMs,
      nextRunAt: run.lastRunAt != null ? run.lastRunAt + t.intervalMs : null,
    };
  });
}

/** Execute one task now, recording real duration — used by the manual "run" button and by the queued runner below. */
export async function runTaskNow(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return { ok: false, error: "not_found" };
  const start = Date.now();
  try {
    await task.run();
  } finally {
    recordTaskRun(id, Date.now() - start);
  }
  return { ok: true };
}

/**
 * Which priority bucket each scheduled task competes in when several are
 * overdue at once — several tasks reasonably share a bucket (e.g. every
 * Plex-related task backs off equally behind an active download).
 */
const TASK_JOB_TYPE: Record<string, JobType> = {
  "quality-upgrade-check": "qualityUpgrade",
  "indexer-health-check": "maintenance",
  "library-reconcile": "reconcile",
  "session-cleanup": "maintenance",
  "plex-watchlist-sync": "plexWatchlistSync",
  "plex-library-sync": "plexLibrarySync",
  "plex-watch-sync": "plexWatchlistSync",
  "plex-full-reconcile": "plexLibrarySync",
  "release-day-search": "rssScan",
  "metadata-refresh": "metadataRefresh",
  "rss-indexer-scan": "rssScan",
  "download-state-reconcile": "reconcile",
  "anime-vf-calendar-refresh": "metadataRefresh",
};

const TICK_MS = 30_000;

/**
 * Every task used to get its own setInterval(fn, intervalMs) started at
 * server boot — so a task due to run "now" per its persisted lastRunAt
 * wouldn't actually fire again until a full interval had elapsed from
 * whenever the process last restarted, no matter how overdue it already
 * was. With frequent redeploys that meant daily/hourly tasks could go
 * a long time without ever actually running, despite the Settings table
 * showing them as due. This checks every 30s for anything overdue and
 * runs it through the shared job queue instead, so overdue tasks catch up
 * promptly and compete fairly (by priority) with everything else queued.
 */
function tick() {
  const now = Date.now();
  for (const task of TASKS) {
    if (isSourceActive(task.id)) continue;
    const run = getTaskRun(task.id);
    const dueAt = run.lastRunAt == null ? 0 : run.lastRunAt + task.intervalMs;
    if (now < dueAt) continue;
    const type = TASK_JOB_TYPE[task.id] ?? "maintenance";
    enqueueJob(type, task.name, 1, async (setProgress) => {
      await runTaskNow(task.id);
      setProgress(1, 1);
    }, task.id);
  }
}

/** Manual "run now" trigger — enqueues through the same shared job queue as
 *  the overdue-task ticker above, instead of holding the request open for
 *  the task's full duration. Reuses the task id as the dedup sourceId so a
 *  second click while it's still running doesn't double-run it. */
export function queueTaskRun(id: string): { ok: true } | { ok: false; error: string } {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return { ok: false, error: "not_found" };
  if (isSourceActive(id)) return { ok: true };
  const type = TASK_JOB_TYPE[id] ?? "maintenance";
  enqueueJob(type, task.name, 1, async (setProgress) => {
    await runTaskNow(id);
    setProgress(1, 1);
  }, id);
  return { ok: true };
}

/** Start the scheduler's overdue-task ticker — called once at server boot. */
export function startScheduler() {
  tick();
  setInterval(tick, TICK_MS);
}
