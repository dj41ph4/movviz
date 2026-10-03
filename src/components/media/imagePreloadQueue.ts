/** Limits speculative work only. Visible images never wait in this queue. */
export function createImagePreloadQueue(limit: number) {
  type Job = { key: object; start: () => Promise<void>; distance: number };
  const waiting = new Map<object, Job>();
  const running = new Set<object>();

  function dispatch() {
    while (running.size < limit && waiting.size) {
      const job = [...waiting.values()].sort((a, b) => a.distance - b.distance)[0];
      waiting.delete(job.key);
      running.add(job.key);
      void Promise.resolve().then(job.start).catch(() => {}).finally(() => {
        running.delete(job.key);
        dispatch();
      });
    }
  }

  return {
    enqueue(key: object, start: () => Promise<void>, distance = 0) {
      if (running.has(key)) return;
      waiting.set(key, { key, start, distance });
      dispatch();
    },
    cancel(key: object) { waiting.delete(key); },
  };
}

// Shared by all shelves, not two speculative requests for EACH shelf.
export const carouselImageQueue = createImagePreloadQueue(2);
export const carouselDecodeQueue = createImagePreloadQueue(1);
