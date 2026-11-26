"use client";

/**
 * Envoi en cours vers un écran (« Connexion à… », « Préparation de la vidéo… »,
 * « En attente de la lecture… »). Hors du composant : l'étape continue de
 * s'afficher si le panneau se ferme puis se rouvre, et un seul envoi à la fois.
 */

export type CastStage = "sending" | "picking" | "connecting" | "preparing" | "launching" | "waiting";

export interface CastJob {
  deviceId: string;
  deviceName: string;
  stage: CastStage;
  /** Début de l'étape (compteur « N s » de l'attente). */
  since: number;
}

let job: CastJob | null = null;
const listeners = new Set<() => void>();

function emit(next: CastJob | null) {
  job = next;
  for (const fn of listeners) fn();
}

export function subscribeCastJob(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getCastJob = (): CastJob | null => job;
export const getCastJobServer = (): CastJob | null => null;

/** Démarre un envoi ; `null` si un autre est déjà en cours. */
export function startCastJob(deviceId: string, deviceName: string, stage: CastStage): ((stage: CastStage, deviceName?: string) => void) | null {
  if (job) return null;
  const token = { deviceId };
  emit({ deviceId, deviceName, stage, since: Date.now() });
  current = token;
  return (next, name) => {
    if (current !== token || !job) return;
    emit({ ...job, stage: next, deviceName: name ?? job.deviceName, since: Date.now() });
  };
}

let current: object | null = null;

export function endCastJob() {
  current = null;
  emit(null);
}
