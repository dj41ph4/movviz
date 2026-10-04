/** Plex timestamps are seconds; library timestamps are milliseconds.
 * A metadata/view-state refresh is never a new file arrival. */
export function plexArrivalDate(value: number, now = Date.now()): number {
  const timestamp = value < 10_000_000_000 ? value * 1000 : value;
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now ? timestamp : now;
}
