import { monitorEventLoopDelay } from "node:perf_hooks";

/**
 * Real, direct measurement of Node's single-thread event loop — the thing
 * every "why is the whole app slow, not just one endpoint" investigation
 * ends up guessing about indirectly (CPU%, request timings, log gaps).
 * `monitorEventLoopDelay` is a built-in Node API purpose-built for exactly
 * this: it samples how long the event loop takes to get back around to a
 * timer, which is precisely "how blocked is the single thread everything
 * else is waiting behind." A history of periodic snapshots (not just a
 * live cumulative average since boot) lets a spike be correlated after the
 * fact against whatever job/import/request was running at that timestamp,
 * instead of only ever catching it live.
 */

export interface EventLoopSample {
  t: number;
  meanMs: number;
  maxMs: number;
  p99Ms: number;
}

const g = globalThis as typeof globalThis & {
  __movvizEventLoopHistogram?: ReturnType<typeof monitorEventLoopDelay>;
  __movvizEventLoopHistory?: EventLoopSample[];
  __movvizEventLoopStarted?: boolean;
};

const SAMPLE_INTERVAL_MS = 15_000;
const MAX_SAMPLES = 240; // 1 hour of history at 15s/sample

function toMs(ns: number): number {
  return Number.isFinite(ns) ? Math.round((ns / 1e6) * 100) / 100 : 0;
}

/** Start sampling — idempotent, called once from instrumentation.ts at process boot. */
export function startEventLoopMonitor() {
  if (g.__movvizEventLoopStarted) return;
  g.__movvizEventLoopStarted = true;

  const histogram = (g.__movvizEventLoopHistogram ??= monitorEventLoopDelay({ resolution: 20 }));
  histogram.enable();
  const history: EventLoopSample[] = (g.__movvizEventLoopHistory ??= []);

  setInterval(() => {
    history.push({
      t: Date.now(),
      meanMs: toMs(histogram.mean),
      maxMs: toMs(histogram.max),
      p99Ms: toMs(histogram.percentile(99)),
    });
    while (history.length > MAX_SAMPLES) history.shift();
    // Reset so each sample reflects "in the last 15s", not a lifetime
    // average that gets diluted into meaninglessness after days of uptime.
    histogram.reset();
  }, SAMPLE_INTERVAL_MS).unref();
}

export function getEventLoopHistory(): EventLoopSample[] {
  return g.__movvizEventLoopHistory ?? [];
}

/** Stats for the current (still-accumulating) sampling window. */
export function getEventLoopLive(): EventLoopSample | null {
  const histogram = g.__movvizEventLoopHistogram;
  if (!histogram) return null;
  return { t: Date.now(), meanMs: toMs(histogram.mean), maxMs: toMs(histogram.max), p99Ms: toMs(histogram.percentile(99)) };
}
