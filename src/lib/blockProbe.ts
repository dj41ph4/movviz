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
const MAX_TIMELINE = 1000;

export interface BlockEntry {
  t: number;
  /** Durée du gel observé (retard du tick). */
  ms: number;
  /** Consecutive samples with the same active windows are grouped. */
  count?: number;
  /** Fenêtres ouvertes pendant ce gel. */
  during: string[];
  /** Piles d'appel au moment où chaque fenêtre a été ouverte (pour retrouver le fichier:ligne). */
  duringStacks?: string[];
  /** cpu = thread monopolisé par du JS synchrone ; io = attente réseau/disque. */
  type?: 'cpu' | 'io';
}

interface Window {
  label: string;
  maxGapMs: number;
  type?: 'cpu' | 'io';
  /** Stack capturée à l'ouverture de la fenêtre. */
  openStack?: string;
}

export interface BlockTimelineEvent {
  t: number;
  type: 'open' | 'close';
  label: string;
  id: number;
  windowType?: 'cpu' | 'io';
}

const g = globalThis as typeof globalThis & {
  __movvizBlockWindows?: Map<number, Window>;
  __movvizBlockLog?: BlockEntry[];
  __movvizBlockTimer?: ReturnType<typeof setInterval> | null;
  __movvizBlockSeq?: number;
  __movvizBlockTimeline?: BlockTimelineEvent[];
};
const windows: Map<number, Window> = (g.__movvizBlockWindows ??= new Map());
const log: BlockEntry[] = (g.__movvizBlockLog ??= []);
const timeline: BlockTimelineEvent[] = (g.__movvizBlockTimeline ??= []);

function pushTimeline(event: Omit<BlockTimelineEvent, 't'>) {
  timeline.push({ t: Date.now(), ...event });
  while (timeline.length > MAX_TIMELINE) timeline.shift();
}

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
      const winList = [...windows.values()];
      const t = Date.now();
      const during = winList.map((w) => w.label);
      const type = winList.length > 0 ? winList[winList.length - 1]?.type : undefined;
      const last = log.at(-1);
      // One sustained incident used to create dozens of identical rows and
      // repeat the same diagnostic stack as an apparent "Error" each time.
      if (last && t - last.t < 5_000 && last.type === type &&
          last.during.length === during.length && last.during.every((label, i) => label === during[i])) {
        last.t = t;
        last.ms = Math.max(last.ms, gap);
        last.count = (last.count ?? 1) + 1;
      } else {
        log.push({
          t, ms: gap, during,
          duringStacks: winList.map((w) => w.openStack ?? null).filter((s): s is string => s != null),
          type,
        });
        while (log.length > MAX_LOG) log.shift();
      }
    }
  }, TICK_MS);
  g.__movvizBlockTimer.unref?.();
}

function stopTickingIfIdle() {
  if (windows.size > 0 || !g.__movvizBlockTimer) return;
  clearInterval(g.__movvizBlockTimer);
  g.__movvizBlockTimer = null;
}

/** Ouvre une fenêtre étiquetée ; `end()` renvoie le pire gel observé pendant qu'elle était ouverte.
 *
 * `type` (optionnel) : 'cpu' si le travail à l'intérieur est du JS synchrone qui monopolise le thread,
 * 'io' si c'est une attente réseau/disque (ne gèle pas l'event loop mais allonge le job).
 */
export function openBlockWindow(
  label: string,
  opts?: { type?: 'cpu' | 'io' },
): { end: () => { maxBlockMs: number; overlapping: string[] } } {
  const id = (g.__movvizBlockSeq = (g.__movvizBlockSeq ?? 0) + 1);
  // This is a call-site trace, not a thrown exception. Drop V8's "Error:"
  // heading so exported diagnostics do not report false errors.
  const openStack = new Error().stack?.split("\n").slice(1, 6).map((line) => line.trim()).join(" ");
  const w: Window = { label, maxGapMs: 0, type: opts?.type, openStack };
  windows.set(id, w);
  pushTimeline({ type: 'open', label, id, windowType: opts?.type });
  ensureTicking();
  return {
    end: () => {
      windows.delete(id);
      pushTimeline({ type: 'close', label, id, windowType: opts?.type });
      const overlapping = [...windows.values()].map((o) => o.label);
      stopTickingIfIdle();
      return { maxBlockMs: w.maxGapMs, overlapping };
    },
  };
}

/** Mesure une fonction asynchrone ; journalise si elle a figé le serveur au-delà de `warnMs`. */
export async function measureBlocking<T>(
  label: string,
  fn: () => Promise<T>,
  warnMs = 1_000,
  opts?: { type?: 'cpu' | 'io' },
): Promise<{ value: T; maxBlockMs: number; durationMs: number }> {
  const w = openBlockWindow(label, opts);
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

/** Timeline des ouvertures/fermetures de fenêtres (le plus récent en dernier). */
export function getBlockTimeline(): BlockTimelineEvent[] {
  return [...timeline].reverse();
}
