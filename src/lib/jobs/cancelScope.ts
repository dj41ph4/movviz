/**
 * Arrêt coopératif d'une tâche en cours (bouton « Arrêter » de Réglages →
 * Tâches planifiées et de la file d'attente).
 *
 * Le job courant est porté par AsyncLocalStorage (même principe que
 * priority/lane.ts) : il se propage à travers tous les awaits du runner,
 * donc les points de cession déjà présents dans les boucles lourdes
 * (yieldToUser, yieldToEventLoop) peuvent vérifier l'arrêt sans qu'on ait
 * à faire passer un identifiant de job dans chaque fonction.
 *
 * Module volontairement sans dépendance (pas d'import de queue.ts) pour
 * pouvoir être importé depuis n'importe quel helper sans cycle.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const g = globalThis as typeof globalThis & {
  __movvizJobScope?: AsyncLocalStorage<string>;
  __movvizJobCancellations?: Set<string>;
};
const scope: AsyncLocalStorage<string> = (g.__movvizJobScope ??= new AsyncLocalStorage<string>());
/** Jobs dont l'arrêt a été demandé — partagé avec queue.ts. */
export const cancelledJobs: Set<string> = (g.__movvizJobCancellations ??= new Set());

/**
 * Lancée par un runner pour terminer le job en « annulé » (et non en
 * « terminé » ou « échoué ») quand son arrêt a été demandé.
 */
export class JobCancelledError extends Error {
  constructor() {
    super("Job annulé");
    this.name = "JobCancelledError";
  }
}

/** Exécute fn dans le contexte du job `jobId`. */
export function runInJobScope<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  return scope.run(jobId, fn);
}

/** Identifiant du job courant, ou null hors d'un job de la file. */
export function currentJobId(): string | null {
  return scope.getStore() ?? null;
}

/** Vrai si l'arrêt du job courant a été demandé. */
export function isCurrentJobCancelled(): boolean {
  const id = scope.getStore();
  return id != null && cancelledJobs.has(id);
}

/** Point d'arrêt : lance JobCancelledError si le job courant doit s'arrêter. */
export function throwIfJobCancelled(): void {
  if (isCurrentJobCancelled()) throw new JobCancelledError();
}

/**
 * Laisse passer les autres requêtes entre deux morceaux d'une longue boucle
 * synchrone (setImmediate), et sert de point d'arrêt.
 */
export function yieldToEventLoop(): Promise<void> {
  throwIfJobCancelled();
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Jobs lancés de force (bouton « Forcer » de la file) : ils ne cèdent plus la main à
 * l'activité des utilisateurs (yieldToUser) — l'administrateur a demandé de les faire passer
 * maintenant. Partagé avec queue.ts ; vidé à la fin du job.
 */
const gForced = globalThis as typeof globalThis & { __movvizForcedJobs?: Set<string> };
export const forcedJobs: Set<string> = (gForced.__movvizForcedJobs ??= new Set());

/** Vrai si le job courant a été lancé de force. */
export function isCurrentJobForced(): boolean {
  const id = scope.getStore();
  return id != null && forcedJobs.has(id);
}
