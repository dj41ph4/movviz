/** Browser-only signal for useful data still loading, independent of clicks.
 * It does not delay, cancel or change any fetch. Pollers/prefetch don't enter it.
 */
let pending = 0;
const listeners = new Set<() => void>();

export function hasForegroundRequests(): boolean { return pending > 0; }

export function subscribeForegroundRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function beginForegroundRequest(): () => void {
  pending++;
  if (pending === 1) listeners.forEach((listener) => listener());
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending--;
    if (pending === 0) listeners.forEach((listener) => listener());
  };
}

/** Direct user-requested loads (including aborts) release their signal in finally. */
export async function withForegroundRequest<T>(request: () => Promise<T>): Promise<T> {
  const end = beginForegroundRequest();
  try { return await request(); }
  finally { end(); }
}

/** Only page/detail data, not continuous status polling or player heartbeats. */
export function isForegroundDataUrl(url: string): boolean {
  const pathname = url.split("?")[0];
  return pathname.startsWith("/api/interface/")
    || pathname.startsWith("/api/metadata/")
    || pathname.startsWith("/api/library/movies")
    || pathname.startsWith("/api/library/series")
    || pathname === "/api/dashboard/hero"
    || pathname === "/api/watch-status"
    || pathname === "/api/watchlist"
    || pathname === "/api/plex/on-deck";
}
