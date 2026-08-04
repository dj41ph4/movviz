/**
 * Per-key async lock serializing read-modify-write sequences against the
 * JSON stores. `updateSeries`/`updateMovie` are plain read-full-list →
 * mutate → write-full-list — two concurrent callers targeting the same
 * series/movie race: whichever writes last wins and silently drops the
 * other's change (confirmed live: several episodes of the same series
 * completing around the same time each triggered their own import callback,
 * and most of the resulting "available" flips were lost, leaving episodes
 * stuck on "downloading" against an already-completed, no-longer-polled
 * torrent). Anchored on globalThis — Next.js bundles routes/schedulers
 * separately, so a module-level Map wouldn't be shared between them.
 */
const gLocks = globalThis as typeof globalThis & {
  __movvizKeyLock?: Map<string, Promise<unknown>>;
};

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const locks = (gLocks.__movvizKeyLock ??= new Map());
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const chain = run
    .then(
      () => undefined,
      () => undefined
    )
    .finally(() => {
      if (locks.get(key) === chain) locks.delete(key);
    });
  locks.set(key, chain);
  return run;
}
