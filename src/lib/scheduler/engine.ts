import { TASKS } from "./tasks";
import { getTaskRun, recordTaskRun, getTaskConfig } from "./state";
import { enqueueJob, isSourceActive, activeJobForSource, requestCancelJob, isStopRequested, wasPreempted } from "@/lib/jobs/queue";
import { currentJobId } from "@/lib/jobs/cancelScope";
import type { JobType } from "@/lib/jobs/types";
import { openBlockWindow } from "@/lib/blockProbe";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { runBackground } from "@/lib/priority/lane";
import { acquisitionInterval } from "./interval";
import { isInTaskWindow, nextInTaskWindow, type TaskWindow } from "./window";
import { factoryResetActive } from "@/lib/system/resetBarrier";

/** Effective interval for a task — persisted override or hardcoded default. */
export function getEffectiveInterval(id: string, defaultMs: number): number {
  const cfg = getTaskConfig(id);
  return acquisitionInterval(id, cfg.intervalMs ?? defaultMs);
}

export interface TaskStatus {
  id: string;
  name: string;
  intervalMs: number;
  /** Plage horaire de démarrage choisie (heure du serveur), ou null. */
  window: TaskWindow | null;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  /** Pire gel du serveur pendant la dernière exécution (null = pas encore mesuré). */
  lastMaxBlockMs: number | null;
  nextRunAt: number | null;
  /** Tâche lourde : une seule à la fois. */
  heavy: boolean;
  /** État dans la file : en attente, en cours, arrêt demandé, ou rien. */
  state: "queued" | "running" | "stopping" | null;
}

export function listTaskStatus(): TaskStatus[] {
  return TASKS.map((t) => {
    const run = getTaskRun(t.id);
    const intervalMs = getEffectiveInterval(t.id, t.intervalMs);
    const window = getTaskConfig(t.id).window ?? null;
    return {
      id: t.id,
      name: t.name,
      intervalMs,
      window,
      lastRunAt: run.lastRunAt,
      lastDurationMs: run.lastDurationMs,
      lastMaxBlockMs: run.lastMaxBlockMs ?? null,
      nextRunAt: run.lastRunAt != null ? nextInTaskWindow(run.lastRunAt + intervalMs, window) : null,
      heavy: HEAVY_TASKS.has(t.id),
      state: taskQueueState(t.id),
    };
  });
}

/** Execute one task now, recording real duration — used by the manual "run" button and by the queued runner below. */
export async function runTaskNow(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return { ok: false, error: "not_found" };
  const start = Date.now();
  // Mesure seule (blockProbe.ts) : quelle tâche fige le serveur, et combien.
  const probe = openBlockWindow(`tâche ${id}`);
  const heapBeforeMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  try {
    // Every scheduled task runs in the « background » lane: shared limited
    // resources (the TMDb queue…) serve a user's request before it.
    await runBackground(() => task.run());
  } finally {
    const { maxBlockMs, overlapping, blockedMs, blockCount } = probe.end();
    // Une ligne par passage lent ou gênant : durée, gel cumulé, tas avant/après et tâches
    // en parallèle. Les gels détaillés (avec l'étape en cours) sont dans /api/perf → blocks.
    const durationMs = Date.now() - start;
    if (durationMs >= 10_000 || blockedMs >= 500) {
      const heapAfterMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      recordSearchLog("info", "perf.task_run", `tâche ${id} : durée ${Math.round(durationMs / 1000)} s, ${blockCount} gel(s) ≥ 200 ms pour ${Math.round(blockedMs / 1000)} s cumulées (pire ${maxBlockMs} ms), tas ${heapBeforeMb} → ${heapAfterMb} Mo${overlapping.length ? `, en parallèle : ${overlapping.join(", ")}` : ""}`, durationMs);
    }
    // Mise en pause par une action lourde de l'utilisateur : on n'enregistre
    // pas de passage, le planificateur la relance juste après.
    const jobId = currentJobId();
    if (!(jobId && wasPreempted(jobId))) recordTaskRun(id, Date.now() - start, maxBlockMs);
    if (maxBlockMs >= 1_000) {
      recordSearchLog("warn", "perf.task_block", `tâche ${id} : serveur figé jusqu'à ${maxBlockMs} ms (durée ${Date.now() - start} ms)${overlapping.length ? ` — en parallèle : ${overlapping.join(", ")}` : ""}`, maxBlockMs);
    }
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
  "auto-upgrade-all": "qualityUpgrade",
  "search-and-replace-check": "qualityUpgrade",
  "indexer-health-check": "maintenance",
  "library-reconcile": "reconcile",
  "disk-scan": "reconcile",
  "stuck-downloads-recover": "reconcile",
  "library-health-check": "reconcile",
  "trash-purge": "maintenance",
  "session-cleanup": "maintenance",
  "server-benchmark": "maintenance",
  "plex-watchlist-sync": "plexWatchlistSync",
  "plex-library-sync": "plexLibrarySync",
  "plex-marker-sync": "plexMarkerSync",
  "plex-watch-sync": "plexWatchlistSync",
  "plex-watch-bootstrap": "plexWatchlistSync",
  "plex-full-reconcile": "plexLibrarySync",
  "release-day-search": "rssScan",
  // Était « maintenance » (le plus bas) faute d'entrée : la relance des
  // manquants passait derrière tout le reste.
  "retry-missing-movies": "rssScan",
  "metadata-refresh": "metadataRefresh",
  "artwork-cache-refresh": "metadataRefresh",
  "language-detection": "metadataRefresh",
  "rss-indexer-scan": "rssScan",
  "download-state-reconcile": "reconcile",
  "anime-vf-calendar-refresh": "metadataRefresh",
  "seerr-import": "seerrImport",
};

/**
 * Tâches lourdes (CPU, disque ou centaines de requêtes) : jamais deux en
 * même temps (voir HEAVY_SOFT_LIMIT_MS dans queue.ts). Les petites tâches
 * fréquentes (état des téléchargements, RSS, Seerr, Plex) et les actions de
 * l'utilisateur ne sont pas concernées — elles ne doivent jamais attendre
 * une relance des manquants de 30 min.
 */
export const HEAVY_TASKS = new Set<string>([
  "disk-scan",
  "retry-missing-movies",
  "auto-upgrade-all",
  "search-and-replace-check",
  "quality-upgrade-check",
  "metadata-refresh",
  "library-reconcile",
  "stuck-downloads-recover",
  "plex-full-reconcile",
  "plex-watch-sync",
  "plex-watch-bootstrap",
  "library-health-check",
  "server-benchmark",
]);

/**
 * Aucune tâche planifiée pendant les 3 premières minutes après le démarrage
 * du serveur (demande de Seb, 2026-10-12) : le serveur finit de se préparer
 * sans concurrence. Seules les tâches liées aux téléchargements passent
 * tout de suite, pour qu'un fichier terminé devienne lisible sans attendre.
 * Le bouton « lancer maintenant » n'est pas concerné.
 */
const BOOT_QUIET_MS = 3 * 60 * 1000;
const BOOT_EXEMPT_TASKS = new Set<string>(["download-state-reconcile"]);
const bootAt = Date.now();

function enqueueTask(task: (typeof TASKS)[number]) {
  const type = TASK_JOB_TYPE[task.id] ?? "maintenance";
  enqueueJob(type, task.name, 1, async (setProgress) => {
    await runTaskNow(task.id);
    setProgress(1, 1);
  }, task.id, { heavy: HEAVY_TASKS.has(task.id), scheduled: true });
}

function taskQueueState(id: string): TaskStatus["state"] {
  const job = activeJobForSource(id);
  if (!job) return null;
  if (isStopRequested(job.id)) return "stopping";
  return job.status === "queued" ? "queued" : "running";
}

/** Bouton « Arrêter » : retire la tâche de la file, ou demande son arrêt si elle tourne. */
export function stopTask(id: string): { ok: true } | { ok: false; error: string } {
  const job = activeJobForSource(id);
  if (!job) return { ok: false, error: "not_running" };
  return requestCancelJob(job.id) ? { ok: true } : { ok: false, error: "not_running" };
}

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
  if (factoryResetActive()) return;
  const now = Date.now();
  const quiet = now - bootAt < BOOT_QUIET_MS;
  for (const task of TASKS) {
    if (quiet && !BOOT_EXEMPT_TASKS.has(task.id)) continue;
    if (isSourceActive(task.id)) continue;
    const run = getTaskRun(task.id);
    const intervalMs = getEffectiveInterval(task.id, task.intervalMs);
    const dueAt = run.lastRunAt == null ? 0 : run.lastRunAt + intervalMs;
    if (now < dueAt) continue;
    // Plage horaire choisie : la tâche attend son créneau, l'intervalle reste inchangé.
    if (!isInTaskWindow(now, getTaskConfig(task.id).window)) continue;
    enqueueTask(task);
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
  enqueueTask(task);
  return { ok: true };
}

/** Start the scheduler's overdue-task ticker — called once at server boot. */
export function startScheduler() {
  tick();
  setInterval(tick, TICK_MS);
}
