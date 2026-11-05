/**
 * Télémétrie de tampon du lecteur : les appareils (téléphone, TV, bureau)
 * remontent leurs coupures de lecture (waiting/stalled) et leur réserve de
 * tampon ; /api/perf les expose à côté des gels de la boucle d'événements pour
 * savoir si une coupure vue à l'écran vient du serveur ou du réseau.
 */

export interface PlaybackStall {
  t: number;
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
  mode: string;
  device: string;
  bufAhead: number;
  pos: number;
  net: string | null;
  sid: string | null;
}

const MAX_STALLS = 300;
const MAX_SAMPLES = 600;

// globalThis-anchored : mêmes bundles séparés que perf.ts.
const g = globalThis as typeof globalThis & {
  __movvizPlaybackTelemetry?: { stalls: PlaybackStall[]; samples: PlaybackSample[] };
};
const store = (g.__movvizPlaybackTelemetry ??= { stalls: [], samples: [] });

export function recordStall(s: PlaybackStall) {
  store.stalls.push(s);
  while (store.stalls.length > MAX_STALLS) store.stalls.shift();
}

export function recordSample(s: PlaybackSample) {
  store.samples.push(s);
  while (store.samples.length > MAX_SAMPLES) store.samples.shift();
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

export function getPlaybackTelemetry(): PlaybackTelemetrySummary {
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
  for (const s of store.stalls) {
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
  for (const s of store.samples) {
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
  return { groups, stalls: store.stalls.slice(-100), samples: store.samples.slice(-120) };
}
