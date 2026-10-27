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

import fs from "node:fs";
import path from "node:path";
import { PerformanceObserver } from "node:perf_hooks";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

const TICK_MS = 100;
/** Retard de tick à partir duquel un gel compte dans le total et le nombre de gels d'une fenêtre. */
const COUNT_BLOCK_MS = 200;
/** Pause du ramasse-miettes gardée dans le journal GC. */
const GC_LOG_MS = 100;
/** Gel / pause GC écrits dans le fichier d'incidents durable (survit aux redémarrages). */
const INCIDENT_BLOCK_MS = 1_000;
const INCIDENT_GC_MS = 300;
const MAX_GC_LOG = 200;
const INCIDENT_FILE_MAX_BYTES = 2 * 1024 * 1024;
const MAX_OPS_IN_ENTRY = 8;
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
  /** Étapes suivies (trackOp) en cours à cet instant, la plus ancienne d'abord : « étape (âge) ». */
  ops?: string[];
  /** Appels sortants (fetch) en attente à cet instant, et le plus ancien. */
  netInflight?: { count: number; oldest?: string };
  /** Tas JS utilisé (Mo) au moment du gel. */
  heapMb?: number;
}

export interface GcEntry {
  t: number;
  ms: number;
  kind: 'mineur' | 'majeur' | 'incrémental' | 'autre';
  heapMb: number;
}

interface ActiveOp {
  label: string;
  kind: 'step' | 'net';
  start: number;
}

interface Window {
  label: string;
  maxGapMs: number;
  /** Somme des retards de tick ≥ COUNT_BLOCK_MS et leur nombre. */
  totalGapMs: number;
  gapCount: number;
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
  __movvizBlockOps?: Map<number, ActiveOp>;
  __movvizBlockAlways?: boolean;
  __movvizGcLog?: GcEntry[];
  __movvizGcObserver?: PerformanceObserver;
  __movvizGcTotals?: { count: number; totalMs: number; majorCount: number; majorMs: number };
};
const windows: Map<number, Window> = (g.__movvizBlockWindows ??= new Map());
const log: BlockEntry[] = (g.__movvizBlockLog ??= []);
const timeline: BlockTimelineEvent[] = (g.__movvizBlockTimeline ??= []);
const ops: Map<number, ActiveOp> = (g.__movvizBlockOps ??= new Map());
const gcLog: GcEntry[] = (g.__movvizGcLog ??= []);
const gcTotals = (g.__movvizGcTotals ??= { count: 0, totalMs: 0, majorCount: 0, majorMs: 0 });

const INCIDENT_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const INCIDENT_FILE = path.join(INCIDENT_DIR, "perf-incidents.jsonl");

/**
 * Journal durable des incidents (gels ≥ 1 s, pauses GC ≥ 300 ms) : une ligne JSON par
 * incident, avec ce qui tournait à cet instant. Le journal en mémoire et le journal de
 * recherche (4000 lignes noyées par le debug) perdent les incidents après un redémarrage
 * ou quelques minutes de recherches ; ce fichier les garde. Écriture asynchrone, jamais
 * bloquante, rotation à 2 Mo (un seul fichier .1 conservé).
 */
let incidentBytes = -1;
function appendIncident(record: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...record }) + "\n";
  void (async () => {
    try {
      await fs.promises.mkdir(INCIDENT_DIR, { recursive: true });
      if (incidentBytes < 0) incidentBytes = await fs.promises.stat(INCIDENT_FILE).then((s) => s.size).catch(() => 0);
      if (incidentBytes > INCIDENT_FILE_MAX_BYTES) {
        await fs.promises.rename(INCIDENT_FILE, `${INCIDENT_FILE}.1`).catch(() => {});
        incidentBytes = 0;
      }
      await fs.promises.appendFile(INCIDENT_FILE, line, "utf8");
      incidentBytes += line.length;
    } catch { /* diagnostic best-effort */ }
  })();
}

const heapMb = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

/**
 * Étape logique en cours (un film recherché, un dossier scanné, un appel sortant…).
 * Une fenêtre dit QUELLE TÂCHE tourne ; une étape dit QUOI dans la tâche : sans elle, un
 * gel pendant une relance de 36 minutes restait attribué à la tâche entière.
 */
export function beginOp(label: string, kind: 'step' | 'net' = 'step'): () => void {
  const id = (g.__movvizBlockSeq = (g.__movvizBlockSeq ?? 0) + 1);
  ops.set(id, { label, kind, start: Date.now() });
  return () => { ops.delete(id); };
}

/** Exécute `fn` en notant `label` comme étape en cours pendant toute sa durée. */
export async function trackOp<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const end = beginOp(label);
  try { return await fn(); } finally { end(); }
}

function describeOps() {
  const now = Date.now();
  const all = [...ops.values()].sort((a, b) => a.start - b.start);
  const steps = all.filter((o) => o.kind === 'step');
  const net = all.filter((o) => o.kind === 'net');
  const age = (o: ActiveOp) => `${o.label} (${Math.round((now - o.start) / 1000)} s)`;
  return {
    ops: steps.slice(0, MAX_OPS_IN_ENTRY).map(age),
    netInflight: { count: net.length, oldest: net[0] ? age(net[0]) : undefined },
  };
}

/** Étapes et appels sortants en cours maintenant (pour /api/perf). */
export function getActiveOps() {
  return describeOps();
}

const GC_KINDS: Record<number, GcEntry['kind']> = { 1: 'mineur', 2: 'majeur', 4: 'majeur', 8: 'incrémental', 16: 'autre' };

/** Observe les pauses du ramasse-miettes : un tas presque plein les rend longues et fréquentes. */
export function startGcWatch() {
  if (g.__movvizGcObserver) return;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const raw = e as unknown as { detail?: { kind?: number }; kind?: number };
        const kind = GC_KINDS[raw.detail?.kind ?? raw.kind ?? 0] ?? 'autre';
        const ms = Math.round(e.duration);
        gcTotals.count += 1;
        gcTotals.totalMs += ms;
        if (kind === 'majeur') { gcTotals.majorCount += 1; gcTotals.majorMs += ms; }
        if (ms < GC_LOG_MS) continue;
        const entry: GcEntry = { t: Date.now(), ms, kind, heapMb: heapMb() };
        gcLog.push(entry);
        while (gcLog.length > MAX_GC_LOG) gcLog.shift();
        if (ms >= INCIDENT_GC_MS) {
          appendIncident({ type: 'gc', ...entry, ...describeOps(), windows: [...windows.values()].map((w) => w.label) });
          recordSearchLog("warn", "perf.gc", `pause GC ${kind} de ${ms} ms (tas ${entry.heapMb} Mo)`, ms);
        }
      }
    });
    obs.observe({ entryTypes: ['gc'] });
    g.__movvizGcObserver = obs;
  } catch { /* entrées gc indisponibles : diagnostic seulement */ }
}

export function getGcLog(): GcEntry[] {
  return [...gcLog];
}

export function getGcTotals() {
  return { ...gcTotals };
}

/**
 * Garde l'horloge de 100 ms allumée en permanence : sans elle, un gel survenu hors de toute
 * tâche (requête utilisateur, GC) n'était vu que dans l'histogramme agrégé de 15 s.
 */
export function startBlockWatch() {
  g.__movvizBlockAlways = true;
  ensureTicking();
}

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
    for (const w of windows.values()) {
      if (gap > w.maxGapMs) w.maxGapMs = gap;
      if (gap >= COUNT_BLOCK_MS) { w.totalGapMs += gap; w.gapCount += 1; }
    }
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
        const detail = describeOps();
        const entry: BlockEntry = {
          t, ms: gap, during,
          duringStacks: winList.map((w) => w.openStack ?? null).filter((s): s is string => s != null),
          type,
          ...detail,
          heapMb: heapMb(),
        };
        log.push(entry);
        while (log.length > MAX_LOG) log.shift();
        if (gap >= INCIDENT_BLOCK_MS) appendIncident({ type: 'block', ms: gap, during, ...detail, heapMb: entry.heapMb });
      }
    }
  }, TICK_MS);
  g.__movvizBlockTimer.unref?.();
}

function stopTickingIfIdle() {
  if (windows.size > 0 || g.__movvizBlockAlways || !g.__movvizBlockTimer) return;
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
): { end: () => { maxBlockMs: number; overlapping: string[]; blockedMs: number; blockCount: number } } {
  const id = (g.__movvizBlockSeq = (g.__movvizBlockSeq ?? 0) + 1);
  // This is a call-site trace, not a thrown exception. Drop V8's "Error:"
  // heading so exported diagnostics do not report false errors.
  const openStack = new Error().stack?.split("\n").slice(1, 6).map((line) => line.trim()).join(" ");
  const w: Window = { label, maxGapMs: 0, totalGapMs: 0, gapCount: 0, type: opts?.type, openStack };
  windows.set(id, w);
  pushTimeline({ type: 'open', label, id, windowType: opts?.type });
  ensureTicking();
  return {
    end: () => {
      windows.delete(id);
      pushTimeline({ type: 'close', label, id, windowType: opts?.type });
      const overlapping = [...windows.values()].map((o) => o.label);
      stopTickingIfIdle();
      return { maxBlockMs: w.maxGapMs, overlapping, blockedMs: w.totalGapMs, blockCount: w.gapCount };
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
