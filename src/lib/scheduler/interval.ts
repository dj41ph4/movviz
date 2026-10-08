/** Automatic acquisition must check at least three times per day.
 * Faster defaults/overrides are preserved; old daily overrides are capped. */
export function acquisitionInterval(id: string, intervalMs: number): number {
  if (["rss-indexer-scan", "release-day-search", "retry-missing-movies"].includes(id)) {
    return Math.min(intervalMs, 8 * 60 * 60 * 1000);
  }
  return intervalMs;
}
