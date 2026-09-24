/**
 * Attribution des gels de la boucle d'événements. L'historique global
 * (eventLoopMonitor.ts) dit QUAND le serveur a figé, pas QUI : il fallait
 * recouper les heures avec /api/tasks à la main, et plusieurs pics de 4 à
 * 11 s (dont un au démarrage) sont restés inexpliqués.
 *
 * Une « fenêtre » étiquetée (tâche planifiée, étape du démarrage…) est
 * ouverte autour d'un travail ; une horloge de 100 ms, active seulement tant
 * qu'au moins une fenêtre est ouverte, mesure le retard de chaque tick et
 * l'attribue à TOUTES les fenêtres ouvertes à ce moment (les chevauchements
 * sont notés, jamais devinés). Mesure seule : aucun comportement modifié.
 *
 * Ancré sur globalThis : partagé entre les bundles Next.js du processus.
 */

import { recordSearchLog } from "@/lib/diagnostic/searchLog";

const TICK_MS = 100;
/** Gel à partir duquel une entrée est gardée dans le journal des gels. */
const LOG_BLOCK_MS = 500;
const MAX_LOG = 300;

export interface BlockEntry {
  t: number;
  /** Durée du gel observé (retard du tick). */
  ms: number;
  /** Fenêtres ouvertes pendant ce gel. */
  during: string[];
}

interface Window {
  label: string;
  maxGapMs: number;
}

const g = globalThis as typeof globalThis & {
  __movvizBlockWindows?: Map<number, Window>;
  __movvizBlockLog?: BlockEntry[];
  __movvizBlockTimer?: ReturnType<typeof setInterval> | null;
  __movvizBlockSeq?: number;
};
const windows: Map<number, Window> = (g.__movvizBlockWindows ??= new Map());
const log: BlockEntry[] = (g.__movvizBlockLog ??= []);

function ensureTicking() {
  if (g.__movvizBlockTimer) return;
  let last = performance.now();
  g.__movvizBlockTimer = setInterval(() => {
    const now = performance.now();
    const gap = Math.round(now - last - TICK_MS);
    last = now;
    if (gap <= 0) return;
    for (const w of windows.values()) if (gap > w.maxGapMs) w.maxGapMs = gap;
    if (gap >= LOG_BLOCK_MS) {
      log.push({ t: Date.now(), ms: gap, during: [...windows.values()].map((w) => w.label) });
      while (log.length > MAX_LOG) log.shift();
    }
  }, TICK_MS);
  g.__movvizBlockTimer.unref?.();
}

function stopTickingIfIdle() {
  if (windows.size > 0 || !g.__movvizBlockTimer) return;
  clearInterval(g.__movvizBlockTimer);
  g.__movvizBlockTimer = null;
}

/** Ouvre une fenêtre étiquetée ; `end()` renvoie le pire gel observé pendant qu'elle était ouverte. */
export function openBlockWindow(label: string): { end: () => { maxBlockMs: number; overlapping: string[] } } {
  const id = (g.__movvizBlockSeq = (g.__movvizBlockSeq ?? 0) + 1);
  const w: Window = { label, maxGapMs: 0 };
  windows.set(id, w);
  ensureTicking();
  return {
    end: () => {
      windows.delete(id);
      const overlapping = [...windows.values()].map((o) => o.label);
      stopTickingIfIdle();
      return { maxBlockMs: w.maxGapMs, overlapping };
    },
  };
}

/** Mesure une fonction asynchrone ; journalise si elle a figé le serveur au-delà de `warnMs`. */
export async function measureBlocking<T>(label: string, fn: () => Promise<T>, warnMs = 1_000): Promise<{ value: T; maxBlockMs: number; durationMs: number }> {
  const w = openBlockWindow(label);
  const start = Date.now();
  let value: T;
  let maxBlockMs = 0;
  try {
    value = await fn();
  } finally {
    const result = w.end();
    if (result.maxBlockMs >= warnMs) {
      recordSearchLog(
        "warn",
        "perf.block",
        `${label} : serveur figé jusqu'à ${result.maxBlockMs} ms (durée ${Date.now() - start} ms)${result.overlapping.length ? ` — en parallèle : ${result.overlapping.join(", ")}` : ""}`,
        result.maxBlockMs,
      );
    }
    maxBlockMs = result.maxBlockMs;
  }
  return { value, maxBlockMs, durationMs: Date.now() - start };
}

/** Journal des gels ≥ 500 ms observés pendant une fenêtre (le plus récent en dernier). */
export function getBlockLog(): BlockEntry[] {
  return [...log];
}
