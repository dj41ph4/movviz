/**
 * Latest playback position reported by an ambient YouTube trailer (from the
 * widget's own infoDelivery messages). Lets a mirrored copy — the dashboard
 * hero's ambilight — stay frame-aligned with the visible video instead of
 * drifting on its own clock.
 */
type Clock = { key: string; time: number; at: number; playing: boolean };

const g = globalThis as typeof globalThis & { __movvizHeroVideoClock?: Clock | null };

export function reportVideoTime(key: string, time: number, playing: boolean): void {
  g.__movvizHeroVideoClock = { key, time, at: performance.now(), playing };
}

/** Estimated current position of `key` right now, or null if unknown. */
export function videoPositionNow(key: string): { time: number; playing: boolean } | null {
  const clock = g.__movvizHeroVideoClock;
  if (!clock || clock.key !== key) return null;
  const elapsed = clock.playing ? (performance.now() - clock.at) / 1000 : 0;
  return { time: clock.time + elapsed, playing: clock.playing };
}
