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
  __movvizKeyLockHolders?: Map<string, { since: number; where: string }>;
};

/** A wait this long is not contention any more: someone never let go. */
const LONG_WAIT_MS = 60_000;

/** Who asked for the lock, as a short readable trail (the frames above withKeyLock). */
function callSite(): string {
  const lines = (new Error().stack ?? "").split("\n").slice(3, 7).map((l) => l.trim().replace(/^at /, "").replace(/\(?[^()]*[\\/](?:server|src)[\\/]/, "(").slice(0, 90));
  return lines.join(" < ") || "inconnu";
}

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const locks = (gLocks.__movvizKeyLock ??= new Map());
  const holders = (gLocks.__movvizKeyLockHolders ??= new Map());
  const prev = locks.get(key) ?? Promise.resolve();
  const where = callSite();
  // Written once when a caller has waited a full minute: which operation
  // holds the key, and since when. On 2026-11-16 two tasks waited for ever
  // on a series lock and nothing said who held it.
  const waiting = setTimeout(() => {
    const holder = holders.get(key);
    void import("@/lib/diagnostic/searchLog").then(({ recordSearchLog }) => recordSearchLog(
      "warn",
      "lock.wait",
      `Verrou « ${key} » attendu depuis 1 min par [${where}] — ${holder ? `tenu depuis ${Math.round((Date.now() - holder.since) / 1000)} s par [${holder.where}]` : "détenteur inconnu"}`,
    )).catch(() => {});
  }, LONG_WAIT_MS);
  waiting.unref?.();
  const held = () => {
    clearTimeout(waiting);
    const mine = { since: Date.now(), where };
    holders.set(key, mine);
    return fn().finally(() => { if (holders.get(key) === mine) holders.delete(key); });
  };
  const run = prev.then(held, held);
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
