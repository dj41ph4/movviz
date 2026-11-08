/**
 * Télémétrie de tampon du lecteur : les appareils (téléphone, TV, bureau)
 * remontent leurs coupures de lecture (waiting/stalled) et leur réserve de
 * tampon ; /api/perf les expose à côté des gels de la boucle d'événements pour
 * savoir si une coupure vue à l'écran vient du serveur ou du réseau.
 */

import fs from "node:fs";
import path from "node:path";

export interface PlaybackStall {
  t: number;
  /** Utilisateur Movviz qui lisait (pour retrouver les coupures d'une personne). */
  user?: string;
  /** DIRECT_PLAY, REMUX, TRANSCODE, HLS, MSE, FFMPEG, DIRECT… */
  mode: string;
  device: string;
  cause: "waiting" | "stalled" | "seek";
  /** Durée de la coupure en ms ; null tant qu'elle n'est pas terminée (page fermée). */
  ms: number | null;
  /** Secondes de tampon devant la tête de lecture au début de la coupure. */
  bufAhead: number;
  pos: number;
  readyState: number;
  networkState: number;
  net: string | null;
  sid: string | null;
}

export interface PlaybackSample {
  t: number;
  user?: string;
  mode: string;
  device: string;
  bufAhead: number;
  pos: number;
  net: string | null;
  sid: string | null;
}

const MAX_STALLS = 5000;
const MAX_SAMPLES = 15000;
/** Durée de conservation sur disque : 72 h maximum. */
const RETENTION_MS = 72 * 3600_000;
/** Un échantillon par session et par 30 s suffit sur disque (le client en envoie un toutes les 10 s). */
const SAMPLE_MIN_GAP_MS = 30_000;
const FLUSH_EVERY_MS = 60_000;

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "playback-telemetry.json");

type Store = { stalls: PlaybackStall[]; samples: PlaybackSample[] };

// globalThis-anchored : mêmes bundles séparés que perf.ts.
const g = globalThis as typeof globalThis & {
  __movvizPlaybackTelemetry?: Store;
  __movvizPlaybackTelemetryTimer?: ReturnType<typeof setTimeout> | null;
};

function prune(st: Store) {
  const min = Date.now() - RETENTION_MS;
  st.stalls = st.stalls.filter((s) => s.t >= min).slice(-MAX_STALLS);
  st.samples = st.samples.filter((s) => s.t >= min).slice(-MAX_SAMPLES);
}

function loadFromDisk(): Store {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<Store>;
      const st = {
        stalls: Array.isArray(raw.stalls) ? raw.stalls : [],
        samples: Array.isArray(raw.samples) ? raw.samples : [],
      };
      prune(st);
      return st;
    }
  } catch {
    // fichier absent ou corrompu : on repart à vide
  }
  return { stalls: [], samples: [] };
}

const store = (g.__movvizPlaybackTelemetry ??= loadFromDisk());

function flushToDisk() {
  try {
    prune(store);
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("[playbackTelemetry] failed to persist:", err);
  }
}

function scheduleFlush() {
  if (g.__movvizPlaybackTelemetryTimer) return;
  g.__movvizPlaybackTelemetryTimer = setTimeout(() => {
    g.__movvizPlaybackTelemetryTimer = null;
    flushToDisk();
  }, FLUSH_EVERY_MS);
}

export function recordStall(s: PlaybackStall) {
  store.stalls.push(s);
  if (store.stalls.length > MAX_STALLS) store.stalls.shift();
  scheduleFlush();
}

export function recordSample(s: PlaybackSample) {
  const last = store.samples.findLast((x) => x.sid === s.sid && x.user === s.user);
  if (last && s.t - last.t < SAMPLE_MIN_GAP_MS) return;
  store.samples.push(s);
  if (store.samples.length > MAX_SAMPLES) store.samples.shift();
  scheduleFlush();
}

export interface PlaybackTelemetrySummary {
  /** Par appareil et mode de lecture : nombre et durée des coupures, tampon moyen/minimal. */
  groups: {
    device: string;
    mode: string;
    stalls: number;
    /** Événements « stalled » du navigateur (réseau lent), comptés à part. */
    stalledEvents: number;
    stallMsTotal: number;
    stallMsMax: number;
    avgBufAheadAtStall: number;
    samples: number;
    avgBufAhead: number;
    minBufAhead: number;
  }[];
  stalls: PlaybackStall[];
  samples: PlaybackSample[];
}

export function getPlaybackTelemetry(user?: string): PlaybackTelemetrySummary {
  const stalls = user ? store.stalls.filter((s) => s.user === user) : store.stalls;
  const samples = user ? store.samples.filter((s) => s.user === user) : store.samples;
  const map = new Map<string, PlaybackTelemetrySummary["groups"][number] & { bufSum: number; stallBufSum: number }>();
  const group = (device: string, mode: string) => {
    const key = `${device}\u0000${mode}`;
    let gr = map.get(key);
    if (!gr) {
      gr = { device, mode, stalls: 0, stalledEvents: 0, stallMsTotal: 0, stallMsMax: 0, avgBufAheadAtStall: 0, samples: 0, avgBufAhead: 0, minBufAhead: Infinity, bufSum: 0, stallBufSum: 0 };
      map.set(key, gr);
    }
    return gr;
  };
  for (const s of stalls) {
    if (s.cause === "seek") continue;
    const gr = group(s.device, s.mode);
    if (s.cause === "stalled") { gr.stalledEvents++; continue; }
    gr.stalls++;
    gr.stallBufSum += s.bufAhead;
    if (s.ms !== null) {
      gr.stallMsTotal += s.ms;
      if (s.ms > gr.stallMsMax) gr.stallMsMax = s.ms;
    }
  }
  for (const s of samples) {
    const gr = group(s.device, s.mode);
    gr.samples++;
    gr.bufSum += s.bufAhead;
    if (s.bufAhead < gr.minBufAhead) gr.minBufAhead = s.bufAhead;
  }
  const groups = [...map.values()].map(({ bufSum, stallBufSum, ...gr }) => ({
    ...gr,
    avgBufAheadAtStall: gr.stalls ? Math.round((stallBufSum / gr.stalls) * 10) / 10 : 0,
    avgBufAhead: gr.samples ? Math.round((bufSum / gr.samples) * 10) / 10 : 0,
    minBufAhead: Number.isFinite(gr.minBufAhead) ? gr.minBufAhead : 0,
  }));
  return { groups, stalls: stalls.slice(-100), samples: samples.slice(-120) };
}
