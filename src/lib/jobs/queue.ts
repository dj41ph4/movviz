import { engineGet } from "@/lib/engine/server";
import { priorityOf } from "./priorities";
import type { Job, JobType } from "./types";

const MAX_CONCURRENT = 3;
// While a torrent is actively downloading, background jobs back off to leave
// room for the download. Was 1 (fully serial): a slow background sync
// (Plex views, Plex library) already running when the user clicked a
// user-initiated action (e.g. "Rechercher les manquants") made that action
// wait for the whole sync to finish before even starting — up to several
// minutes with no visible reason, since a running job can't be preempted,
// only queued jobs are re-picked. 2 lets one such action start alongside
// whatever's already running instead of queuing behind it, while still
// leaving well short of MAX_CONCURRENT during active downloads.
const MAX_CONCURRENT_WHILE_DOWNLOADING = 2;
const MAX_HISTORY = 100;

export type ProgressFn = (current: number, total: number) => void;
type Runner = (setProgress: ProgressFn) => Promise<void>;

interface QueueState {
  jobs: Job[]; // newest first, capped at MAX_HISTORY
  pending: Map<string, Runner>;
  runningCount: number;
}

const g = globalThis as typeof globalThis & { __movvizJobQueue?: QueueState };
const state: QueueState = (g.__movvizJobQueue ??= { jobs: [], pending: new Map(), runningCount: 0 });

let lastDownloadCheck = 0;
let lastDownloadActive = false;

async function isDownloadActive(): Promise<boolean> {
  const now = Date.now();
  if (now - lastDownloadCheck < 5000) return lastDownloadActive;
  lastDownloadCheck = now;
  const data = await engineGet<{ torrents: { state: string }[] }>("torrents");
  lastDownloadActive = (data?.torrents ?? []).some((t) => t.state === "downloading");
  return lastDownloadActive;
}

function nextId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueJob(type: JobType, label: string, total: number, runner: Runner, sourceId?: string): Job {
  const job: Job = {
    id: nextId(),
    type,
    label,
    status: "queued",
    current: 0,
    total,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    error: null,
    sourceId,
  };
  state.jobs.unshift(job);
  if (state.jobs.length > MAX_HISTORY) state.jobs.length = MAX_HISTORY;
  state.pending.set(job.id, runner);
  void dispatch();
  return job;
}

async function dispatch() {
  const limit = (await isDownloadActive()) ? MAX_CONCURRENT_WHILE_DOWNLOADING : MAX_CONCURRENT;
  while (state.runningCount < limit) {
    const next = pickNextQueued();
    if (!next) return;
    const { job, runner } = next;
    state.pending.delete(job.id);
    job.status = "running";
    job.startedAt = Date.now();
    state.runningCount++;
    runJob(job, runner);
  }
}

function pickNextQueued(): { job: Job; runner: Runner } | null {
  let best: Job | null = null;
  for (const job of state.jobs) {
    if (job.status !== "queued") continue;
    if (!best || priorityOf(job.type) > priorityOf(best.type)) best = job;
    else if (priorityOf(job.type) === priorityOf(best.type) && job.createdAt < best.createdAt) best = job;
  }
  if (!best) return null;
  const runner = state.pending.get(best.id);
  if (!runner) return null;
  return { job: best, runner };
}

function runJob(job: Job, runner: Runner) {
  const setProgress: ProgressFn = (current, total) => {
    job.current = current;
    if (total) job.total = total;
  };
  runner(setProgress)
    .then(() => {
      job.status = "completed";
    })
    .catch((err) => {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
    })
    .finally(() => {
      job.completedAt = Date.now();
      state.runningCount--;
      void dispatch();
    });
}

export function getJobs(): Job[] {
  return state.jobs.slice();
}

export function getJobsByType(type: JobType): Job[] {
  return state.jobs.filter((j) => j.type === type);
}

/** True if a job of this type is queued or currently running. */
export function isTypeActive(type: JobType): boolean {
  return state.jobs.some((j) => j.type === type && (j.status === "queued" || j.status === "running"));
}

/** True if a job from this specific source (e.g. a scheduled task id) is queued or running. */
export function isSourceActive(sourceId: string): boolean {
  return state.jobs.some((j) => j.sourceId === sourceId && (j.status === "queued" || j.status === "running"));
}
