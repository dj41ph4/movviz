/**
 * Server-wide cap on concurrent ffprobe processes. A daily full Plex
 * reconcile used to fire one background probe per movie at once (~2 000
 * ffprobe processes in the same second on the NAS) — every one of them then
 * hit its 15 s timeout together, nothing reached the cache, and the next
 * reconcile relaunched the exact same wave. The timeout only starts once a
 * task holds a slot, so queued probes never expire while waiting.
 *
 * Two priorities: "foreground" (someone is about to play this file) always
 * runs before "background" (import/sync/bulk warm-up). A queued background
 * task can be promoted when a foreground caller starts waiting on it.
 */

export type ProbePriority = "foreground" | "background";

interface QueuedTask {
  start: () => void;
}

export interface LimitedTask<T> {
  promise: Promise<T>;
  /** Moves the task ahead of every background task if it hasn't started yet. */
  promote: () => void;
}

export function createProbeLimiter(maxConcurrent: number) {
  let running = 0;
  const high: QueuedTask[] = [];
  const low: QueuedTask[] = [];

  function pump() {
    while (running < maxConcurrent) {
      const next = high.shift() ?? low.shift();
      if (!next) return;
      running++;
      next.start();
    }
  }

  function run<T>(priority: ProbePriority, fn: () => Promise<T>): LimitedTask<T> {
    let task!: QueuedTask;
    const promise = new Promise<T>((resolve, reject) => {
      task = {
        start: () => {
          // Free the slot before settling, so a caller that awaits the
          // result already sees it released.
          const release = () => { running--; pump(); };
          Promise.resolve()
            .then(fn)
            .then(
              (value) => { release(); resolve(value); },
              (err) => { release(); reject(err); }
            );
        },
      };
    });
    (priority === "foreground" ? high : low).push(task);
    pump();
    return {
      promise,
      promote: () => {
        const i = low.indexOf(task);
        if (i === -1) return;
        low.splice(i, 1);
        high.push(task);
      },
    };
  }

  return {
    run,
    stats: () => ({ running, queuedForeground: high.length, queuedBackground: low.length }),
  };
}

// On globalThis: Next.js can load this module once per route bundle, and a
// per-bundle limiter would let the scheduler and the playback routes each run
// their own two slots.
const g = globalThis as typeof globalThis & { __movvizProbeLimiter?: ReturnType<typeof createProbeLimiter> };
export const probeLimiter = (g.__movvizProbeLimiter ??= createProbeLimiter(2));
