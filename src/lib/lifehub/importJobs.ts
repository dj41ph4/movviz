import { importLifehubHistory, type LifehubImportResult } from "./importHistory";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import type { User } from "@/lib/auth/types";

/**
 * Same background-job model as src/lib/netflix/importJobs.ts (keyed by
 * userId, in-memory on globalThis, polled by the client): each user's import
 * only ever touches their own watched status.
 */
export interface LifehubImportJob {
  status: "running" | "done" | "error";
  current: number;
  total: number;
  startedAt: number;
  result?: LifehubImportResult;
  error?: string;
}

const g = globalThis as typeof globalThis & { __movvizLifehubImports?: Map<string, LifehubImportJob> };
const jobs: Map<string, LifehubImportJob> = (g.__movvizLifehubImports ??= new Map());

export function getLifehubImportJob(userId: string): LifehubImportJob | null {
  return jobs.get(userId) ?? null;
}

export function startLifehubImportJob(user: User, json: string): boolean {
  const existing = jobs.get(user.id);
  if (existing?.status === "running") return false;

  const job: LifehubImportJob = { status: "running", current: 0, total: 0, startedAt: Date.now() };
  jobs.set(user.id, job);

  importLifehubHistory(user, json, (current, total) => {
    job.current = current;
    job.total = total;
  })
    .then((result) => {
      job.status = "done";
      job.result = result;
      triggerIncrementalContextIfDue(user.id).catch(() => {});
    })
    .catch((err: unknown) => {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "erreur inconnue";
    });

  return true;
}
