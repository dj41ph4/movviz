/**
 * Run an async task per item with at most `limit` running concurrently —
 * used for bulk operations (Seerr import, import lists) that used to await
 * one item at a time inside a single HTTP request, keeping the connection
 * open for the full sequential duration. Same per-item logic, just no
 * longer serialized; a small fixed concurrency keeps it from overwhelming
 * the download engine or TMDb's rate limits the way unlimited Promise.all
 * would.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
