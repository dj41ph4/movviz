const ACTIVITY_EVENTS = new Set([
  "pointerdown", "keydown", "wheel", "scroll", "input", "popstate", "hashchange",
]);

/** Native pointerdown may have detail=0; trust never depends on click count. */
export function isUserActivitySignal(event: { type: string; isTrusted: boolean }): boolean {
  return event.isTrusted && ACTIVITY_EVENTS.has(event.type);
}

export interface ActivityPingThrottle {
  signal(): void;
  cancelPending(): void;
}

/** Leading and trailing throttle: no timer exists without pending activity. */
export function createActivityPingThrottle<Timer>(
  send: () => void,
  clock: {
    now(): number;
    schedule(callback: () => void, delayMs: number): Timer;
    cancel(timer: Timer): void;
    isActive(): boolean;
  },
): ActivityPingThrottle {
  const intervalMs = 1_000;
  let lastSentAt = -Infinity;
  let timer: Timer | null = null;
  let pending = false;

  const flush = () => {
    timer = null;
    if (!pending || !clock.isActive()) {
      pending = false;
      return;
    }
    const now = clock.now();
    const remaining = intervalMs - (now - lastSentAt);
    if (remaining > 0) {
      timer = clock.schedule(flush, remaining);
      return;
    }
    pending = false;
    lastSentAt = now;
    send();
  };

  return {
    signal() {
      if (!clock.isActive()) return;
      pending = true;
      if (timer === null) flush();
    },
    cancelPending() {
      pending = false;
      if (timer !== null) clock.cancel(timer);
      timer = null;
    },
  };
}
