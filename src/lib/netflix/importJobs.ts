import { importNetflixHistory, type NetflixImportResult } from "./importHistory";
import type { User } from "@/lib/auth/types";

/**
 * Real Netflix histories run to thousands of rows (confirmed live: a
 * 3000+ row export) — resolving each distinct title/episode against TMDb is
 * inherently slow (bounded-concurrency network calls), far past what a
 * single HTTP request should hold open. Runs as an in-process background
 * job instead (demande explicite user: "en arrière-plan... que je puisse
 * quitter la page pendant l'importation") — the POST route only starts it
 * and returns immediately; the client polls status separately, and the
 * import keeps running on the server even if the browser tab closes.
 *
 * Keyed by userId (not an opaque job id) on purpose: re-opening the
 * settings page later — even after navigating away and back, or a full
 * reload — immediately finds the same in-progress (or just-finished) import
 * for this user, without the client needing to remember an id across a
 * navigation. Anchored on globalThis (Next.js compiles routes into separate
 * bundles — AGENTS.md convention), in-memory only: a server restart drops
 * an in-flight import, same trade-off as the existing job queue.
 */
export interface NetflixImportJob {
  status: "running" | "done" | "error";
  current: number;
  total: number;
  startedAt: number;
  result?: NetflixImportResult;
  error?: string;
}

const g = globalThis as typeof globalThis & { __movvizNetflixImports?: Map<string, NetflixImportJob> };
const jobs: Map<string, NetflixImportJob> = (g.__movvizNetflixImports ??= new Map());

export function getNetflixImportJob(userId: string): NetflixImportJob | null {
  return jobs.get(userId) ?? null;
}

/** Starts the import if none is already running for this user; returns
 *  false (no-op) if one is. Fire-and-forget by design — callers never await
 *  this, they poll getNetflixImportJob() instead. */
export function startNetflixImportJob(user: User, csv: string): boolean {
  const existing = jobs.get(user.id);
  if (existing?.status === "running") return false;

  const job: NetflixImportJob = { status: "running", current: 0, total: 0, startedAt: Date.now() };
  jobs.set(user.id, job);

  importNetflixHistory(user, csv, (current, total) => {
    job.current = current;
    job.total = total;
  })
    .then((result) => {
      job.status = "done";
      job.result = result;
    })
    .catch((err: unknown) => {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "erreur inconnue";
    });

  return true;
}
