import { engineGet } from "@/lib/engine/server";
import { factoryResetActive } from "@/lib/system/resetBarrier";
import { priorityOf } from "./priorities";
import type { Job, JobType } from "./types";
import { cancelledJobs, JobCancelledError, runInJobScope, forcedJobs } from "./cancelScope";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { hasActivePlayback, hasForegroundActivity, isUserActive, describeBackgroundHold, type BackgroundHold } from "@/lib/priority/userActivity";

export { JobCancelledError };

const MAX_CONCURRENT = 3;
// Watchdog ceiling — confirmed live: a single stuck task (Plex watch-status
// sync, 10+ minutes with zero progress despite the Plex client's own
// per-request timeouts) occupied a concurrency slot indefinitely, starving
// every other job behind it — including a user-triggered manual search,
// which then silently never ran. This is the reason a monitored series can
// go weeks without ever being searched: not a matching bug, the scheduler
// itself was wedged. A stuck runner can't be truly cancelled without
// threading an AbortSignal through every task's own network calls (a much
// larger change), but freeing its queue slot after this ceiling — so the
// rest of the queue keeps moving — closes the actual observed failure mode.
const JOB_TIMEOUT_MS = 10 * 60 * 1000;
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
// Le curseur « Téléchargements » des points de priorité : au-dessus de ce
// seuil, un téléchargement actif réduit la file à
// MAX_CONCURRENT_WHILE_DOWNLOADING ; en dessous, il ne la réduit pas.
const DOWNLOAD_THROTTLE_THRESHOLD = 50;
// Tâches lourdes (scan disque, relance des manquants, mises à niveau…) :
// jamais deux en même temps, quelle que soit la place libre dans la file
// (demande explicite de Seb, 2026-10-12). Leur place ne se libère qu'à la
// vraie fin du runner — pas au délai de garde ci-dessus, qui libère la file
// alors que la tâche continue de tourner. Au-delà de ce plafond, on demande
// seulement son arrêt (coopératif).
const HEAVY_SOFT_LIMIT_MS = 3 * 60 * 60 * 1000;
const MAX_HISTORY = 100;

export type ProgressFn = (current: number, total: number) => void;
export interface RunnerContext {
  jobId: string;
}
type Runner = (setProgress: ProgressFn, ctx: RunnerContext) => Promise<unknown>;

export interface EnqueueOptions {
  /** Acquisition d'un titre ajouté : une place dédiée, sans attendre les tâches de fond. */
  immediate?: boolean;
  /** Tâche lourde : une seule à la fois (voir HEAVY_SOFT_LIMIT_MS). */
  heavy?: boolean;
  /** Lancée par le planificateur : passe après les actions de l'utilisateur. */
  scheduled?: boolean;
}

// Tâches lourdes automatiques mises en pause par une action lourde de
// l'utilisateur (ex. « Rechercher les manquants ») : elles s'arrêtent au
// prochain point de cession et le planificateur les relance juste après,
// sans attendre leur prochain intervalle.
const g3 = globalThis as typeof globalThis & { __movvizPreemptedJobs?: Set<string> };
const preempted: Set<string> = (g3.__movvizPreemptedJobs ??= new Set());

/** Vrai si ce job a été arrêté pour laisser passer une action lourde de l'utilisateur. */
export function wasPreempted(jobId: string): boolean {
  return preempted.has(jobId);
}

interface QueueState {
  jobs: Job[]; // newest first, capped at MAX_HISTORY
  pending: Map<string, Runner>;
  runningCount: number;
  /** Jobs dont le runner tourne encore réellement (même après le délai de garde). */
  live?: Set<string>;
  /** Jobs lourds dont le runner tourne encore réellement. */
  heavyLive?: Set<string>;
  /** Options de chaque job encore en file ou en cours. */
  options?: Map<string, EnqueueOptions>;
}

const g = globalThis as typeof globalThis & { __movvizJobQueue?: QueueState };
const state: QueueState = (g.__movvizJobQueue ??= { jobs: [], pending: new Map(), runningCount: 0 });
const live: Set<string> = (state.live ??= new Set());
const heavyLive: Set<string> = (state.heavyLive ??= new Set());
const jobOptions: Map<string, EnqueueOptions> = (state.options ??= new Map());
let backgroundRetryTimer: ReturnType<typeof setTimeout> | null = null;

function retryHeavyWhenIdle() {
  if (backgroundRetryTimer) return;
  backgroundRetryTimer = setTimeout(() => {
    backgroundRetryTimer = null;
    if (isUserActive() || hasForegroundActivity() || hasActivePlayback()) {
      retryHeavyWhenIdle();
      return;
    }
    void dispatch();
  }, 5_000);
  backgroundRetryTimer.unref?.();
}

// Jobs whose cancellation was requested while running — cooperative: the
// runner checks isJobCancelled(jobId) between items and stops. A running
// job can't be preempted mid-await, but a bulk search checks every item
// (~1.5 s), so cancellation lands within a few seconds. Cleared when the
// job settles (runJob) so the set never grows unbounded.
const cancelled: Set<string> = cancelledJobs;

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

export function enqueueJob(type: JobType, label: string, total: number, runner: Runner, sourceId?: string, options: EnqueueOptions = {}): Job {
  if (factoryResetActive()) throw new Error("factory_reset_in_progress");
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
  jobOptions.set(job.id, options);
  // Une action lourde de l'utilisateur passe devant : la tâche lourde
  // automatique en cours est mise en pause (jamais deux lourdes ensemble).
  if (options.heavy && !options.scheduled) {
    for (const id of heavyLive) {
      if (!jobOptions.get(id)?.scheduled || cancelled.has(id)) continue;
      preempted.add(id);
      cancelled.add(id);
      const running = state.jobs.find((j) => j.id === id);
      recordSearchLog("info", "jobs.heavy_preempted", `« ${running?.label ?? id} » mise en pause pour laisser passer « ${label} »`);
    }
  }
  void dispatch();
  return job;
}

async function dispatch() {
  if (factoryResetActive()) return;
  // One explicit acquisition may start even when scheduled jobs occupy all
  // normal slots. Keep this lane serial and start it before the engine check.
  if (![...live].some((id) => jobOptions.get(id)?.immediate)) {
    const next = pickNextQueued(true);
    if (next) startJob(next.job, next.runner);
  }
  const throttled = (await isDownloadActive()) && priorityOf("download") >= DOWNLOAD_THROTTLE_THRESHOLD;
  if (factoryResetActive()) return;
  const limit = throttled ? MAX_CONCURRENT_WHILE_DOWNLOADING : MAX_CONCURRENT;
  while (state.runningCount < limit) {
    const next = pickNextQueued();
    if (!next) return;
    const { job, runner } = next;
    startJob(job, runner);
  }
}

/** Includes runners that the queue watchdog no longer counts as running. */
export function hasUnfinishedJobs(): boolean {
  return live.size > 0 || state.pending.size > 0;
}

function startJob(job: Job, runner: Runner) {
  state.pending.delete(job.id);
  job.status = "running";
  job.startedAt = Date.now();
  state.runningCount++;
  runJob(job, runner);
}

/** Ordre de passage : actions de l'utilisateur d'abord, puis points de priorité, puis ancienneté. */
function rankOf(job: Job): number {
  return (jobOptions.get(job.id)?.scheduled ? 0 : 1000) + priorityOf(job.type);
}

function pickNextQueued(immediate = false): { job: Job; runner: Runner } | null {
  let best: Job | null = null;
  const heavyBusy = heavyLive.size > 0;
  const scheduledBusy = [...live].some((id) => jobOptions.get(id)?.scheduled && !jobOptions.get(id)?.immediate);
  for (const job of state.jobs) {
    if (job.status !== "queued") continue;
    const options = jobOptions.get(job.id);
    if (!!options?.immediate !== immediate) continue;
    if (heavyBusy && options?.heavy) continue;
    // A scheduled heavy job gets the background lane to itself. Explicit
    // user actions and immediate acquisitions can still take priority.
    if (options?.scheduled && (heavyBusy || (options.heavy && scheduledBusy))) continue;
    // Heavy automation, including the benchmark, waits for page use and
    // playback to finish. Keep it queued and retry without polling the engine
    // while a video is playing; light automation remains eligible.
    if (options?.scheduled && options.heavy && (isUserActive() || hasForegroundActivity() || hasActivePlayback())) {
      noteHeavyHold(job.label);
      retryHeavyWhenIdle();
      continue;
    }
    if (!best || rankOf(job) > rankOf(best)) best = job;
    else if (rankOf(job) === rankOf(best) && job.createdAt < best.createdAt) best = job;
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
  const heavy = !!jobOptions.get(job.id)?.heavy;
  const immediate = !!jobOptions.get(job.id)?.immediate;
  live.add(job.id);
  if (heavy) heavyLive.add(job.id);
  let settled = false;
  // Une tâche lourde n'est jamais « libérée » par le délai de garde : elle
  // garde sa place lourde jusqu'à sa vraie fin. Au plafond, on demande
  // seulement son arrêt.
  const timeoutTimer = heavy || immediate
    ? setTimeout(() => {
        if (settled) return;
        cancelled.add(job.id);
        recordSearchLog("warn", "jobs.heavy_soft_limit", `${job.label} tourne depuis plus de ${Math.round(HEAVY_SOFT_LIMIT_MS / 3600000)} h — arrêt demandé`);
      }, HEAVY_SOFT_LIMIT_MS)
    : setTimeout(() => {
        if (settled) return;
        settled = true;
        job.status = "failed";
        job.error = `Délai dépassé (>${Math.round(JOB_TIMEOUT_MS / 60000)} min) — la tâche est restée bloquée, libération de la file`;
        job.completedAt = Date.now();
        state.runningCount--;
        void dispatch();
      }, JOB_TIMEOUT_MS);

  runInJobScope(job.id, () => runner(setProgress, { jobId: job.id }))
    .finally(() => {
      // Vraie fin du runner (même après le délai de garde) : seulement ici
      // la place lourde se libère et la tâche peut être relancée.
      live.delete(job.id);
      heavyLive.delete(job.id);
      jobOptions.delete(job.id);
      clearCancellation(job.id);
      forcedJobs.delete(job.id);
      // Lu par le planificateur dans le même tour (runTaskNow) — on le
      // retire un peu plus tard pour que l'ensemble ne grossisse pas.
      if (preempted.has(job.id)) setTimeout(() => preempted.delete(job.id), 60_000).unref?.();
      if (heavy || immediate) void dispatch();
    })
    .then((result) => {
      if (settled) return; // watchdog already freed this slot — a late result must not double-decrement runningCount
      settled = true;
      clearTimeout(timeoutTimer);
      job.status = "completed";
      job.result = result;
      job.completedAt = Date.now();
      state.runningCount--;
      void dispatch();
    })
    .catch((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (err instanceof JobCancelledError) {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
      }
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

/** True if a job from this specific source (e.g. a scheduled task id) is queued or running —
 *  including a runner the watchdog released from the queue but that is still going. */
export function isSourceActive(sourceId: string): boolean {
  return state.jobs.some((j) => j.sourceId === sourceId && (j.status === "queued" || j.status === "running" || live.has(j.id)));
}

/** The queued or running job of a source (e.g. a scheduled task id), if any. */
export function activeJobForSource(sourceId: string): Job | null {
  return state.jobs.find((j) => j.sourceId === sourceId && (j.status === "queued" || j.status === "running" || live.has(j.id))) ?? null;
}

/** True when the stop of this job was requested and its runner hasn't ended yet. */
export function isStopRequested(jobId: string): boolean {
  return cancelled.has(jobId) && live.has(jobId);
}

/**
 * Cancel a job. Queued jobs are removed from the queue immediately; running
 * jobs get a cooperative flag the runner polls between items (see
 * isJobCancelled) and settle on their next checkpoint.
 */
export function requestCancelJob(jobId: string): boolean {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return false;
  if (job.status === "queued") {
    state.pending.delete(jobId);
    jobOptions.delete(jobId);
    job.status = "cancelled";
    job.completedAt = Date.now();
    return true;
  }
  if (job.status === "running" || live.has(jobId)) {
    cancelled.add(jobId);
    return true;
  }
  return false;
}

/** Cooperative cancellation check for a running job's runner. */
export function isJobCancelled(jobId: string): boolean {
  return cancelled.has(jobId);
}

function clearCancellation(jobId: string) {
  cancelled.delete(jobId);
}

// ── Pourquoi une tâche attend, et lancement forcé ────────────────────────────

let lastHoldLogAt = 0;
/**
 * Trace (au plus une fois par 5 minutes) pourquoi une tâche lourde planifiée reste en attente :
 * sur un serveur utilisé en continu par plusieurs personnes, elle peut attendre des heures
 * sans qu'aucun log ne le dise.
 */
function noteHeavyHold(label: string) {
  const now = Date.now();
  if (now - lastHoldLogAt < 5 * 60_000) return;
  lastHoldLogAt = now;
  recordSearchLog("info", "jobs.heavy_held", `Tâche lourde « ${label} » en attente : ${JSON.stringify(describeBackgroundHold())}`);
}

export type JobHold =
  | { code: "heavy_running"; task?: string }
  | { code: "lane" }
  | { code: "slot" }
  | { code: "activity"; hold: BackgroundHold };

/** Raison d'attente de chaque job en file — mêmes conditions que pickNextQueued, sans effet de bord. */
export function getJobHolds(): Record<string, JobHold> {
  const holds: Record<string, JobHold> = {};
  const heavyBusy = heavyLive.size > 0;
  const scheduledBusy = [...live].some((id) => jobOptions.get(id)?.scheduled && !jobOptions.get(id)?.immediate);
  const runningHeavy = [...heavyLive].map((id) => state.jobs.find((j) => j.id === id)?.label).find(Boolean);
  const activity = describeBackgroundHold();
  for (const job of state.jobs) {
    if (job.status !== "queued") continue;
    const options = jobOptions.get(job.id);
    if ((heavyBusy && options?.heavy) || (options?.scheduled && heavyBusy)) holds[job.id] = { code: "heavy_running", task: runningHeavy };
    else if (options?.scheduled && options.heavy && scheduledBusy) holds[job.id] = { code: "lane" };
    else if (options?.scheduled && options.heavy && activity) holds[job.id] = { code: "activity", hold: activity };
    else holds[job.id] = { code: "slot" };
  }
  return holds;
}

/**
 * Lancement forcé d'un job en file (bouton « Forcer ») : il passe devant l'activité des
 * utilisateurs, les lectures en cours et la règle « une tâche planifiée à la fois ». Restent
 * respectés : jamais deux tâches lourdes ensemble (règle explicite) et la limite de
 * places de la file — sinon on explique pourquoi au lieu de surcharger le serveur.
 */
export function forceStartJob(id: string): { ok: true } | { ok: false; error: "not_queued" | "heavy_busy" | "queue_full" } {
  const job = state.jobs.find((j) => j.id === id);
  const runner = state.pending.get(id);
  if (!job || job.status !== "queued" || !runner) return { ok: false, error: "not_queued" };
  if (jobOptions.get(id)?.heavy && heavyLive.size > 0) return { ok: false, error: "heavy_busy" };
  if (state.runningCount >= MAX_CONCURRENT) return { ok: false, error: "queue_full" };
  forcedJobs.add(id);
  recordSearchLog("info", "jobs.forced", `« ${job.label} » lancée de force depuis la file d'attente`);
  startJob(job, runner);
  return { ok: true };
}
