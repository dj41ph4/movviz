/**
 * In-memory rate-limit tracker for indexers. When an indexer responds with
 * HTTP 429 (Too Many Requests), we stop querying it for a cooldown period
 * instead of hammering it on every search cycle.
 *
 * Stored on globalThis so it survives HMR. Not persisted to disk — after a
 * restart every indexer starts fresh, which is better than staying locked
 * out for 10 minutes after an unexpected crash.
 */

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const g = globalThis as typeof globalThis & { __movvizRateLimit?: Map<string, number> };
const limits: Map<string, number> = (g.__movvizRateLimit ??= new Map());

/** Mark an indexer as rate-limited (cooldown starts now + 10 min). */
export function markRateLimited(indexerId: string) {
  limits.set(indexerId, Date.now() + COOLDOWN_MS);
}

/** Remove the rate-limit for an indexer (e.g. after a successful test). */
export function clearRateLimit(indexerId: string) {
  limits.delete(indexerId);
}

/** Remove ALL rate limits — called once at server boot so a 429 during the
 *  initial cache seed doesn't lock out every configured indexer for 10 min,
 *  making the RSS scan (and therefore every search) useless until the
 *  cooldown expires. Rate limits are in-memory only and don't survive a
 *  restart, so this starts fresh every boot anyway — this just makes sure
 *  the first cycle itself doesn't poison the 10 min window. */
export function clearAllRateLimits() {
  limits.clear();
}

/** Is this indexer currently in cooldown? */
export function isRateLimited(indexerId: string): boolean {
  const until = limits.get(indexerId);
  if (!until) return false;
  if (Date.now() >= until) {
    limits.delete(indexerId);
    return false;
  }
  return true;
}

/** Filter a list of indexers to only those not currently rate-limited. */
export function withoutRateLimited<T extends { id: string }>(indexers: T[]): T[] {
  return indexers.filter((i) => !isRateLimited(i.id));
}

/**
 * Of a set of indexers that were NOT rate-limited when a direct search
 * started (i.e. came out of withoutRateLimited), how many are rate-limited
 * right now? Since nothing else marks an indexer rate-limited except a 429
 * response inside that same search, a non-zero count here means a 429 was
 * actually hit during the search that just ran — as opposed to an indexer
 * that was already in cooldown before the search even started. Used by the
 * diagnostic search log so "0 résultat" can say *why*: a real 429 hit,
 * indexers already in cooldown, or genuinely nothing found.
 */
export function countNewlyRateLimited(queriedIndexers: { id: string }[]): number {
  return queriedIndexers.filter((i) => isRateLimited(i.id)).length;
}
