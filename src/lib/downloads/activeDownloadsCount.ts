import { engineGet } from "@/lib/engine/server";

interface TorrentSummary {
  state?: string;
}

// The badge only needs a count: never hold the page's shell on the engine's
// full torrent list. While a device listens on /api/events the download watcher
// keeps this value current, and writes it before telling devices to re-read, so
// they never fetch the count from before the change that woke them up.
const g = globalThis as typeof globalThis & { __movvizActiveDownloads?: { value: number; at: number; inflight: Promise<void> | null } };
const cache = (g.__movvizActiveDownloads ??= { value: 0, at: 0, inflight: null });
// Longer than the watcher's 5 s check, so its value is served without an engine call.
const FRESH_MS = 7_000;
const MAX_WAIT_MS = 1_500;

export function isActiveDownload(torrent: TorrentSummary): boolean {
  return torrent.state === "downloading" || torrent.state === "metadata";
}

/** Stores the count of a torrent list just read from the engine; true if it changed. */
export function recordActiveDownloads(torrents: TorrentSummary[]): boolean {
  const value = torrents.filter(isActiveDownload).length;
  const changed = value !== cache.value;
  cache.value = value;
  cache.at = Date.now();
  return changed;
}

export async function activeDownloadsCount(): Promise<number> {
  if (Date.now() - cache.at <= FRESH_MS) return cache.value;
  if (!cache.inflight) {
    const startedAt = Date.now();
    cache.inflight = engineGet<{ torrents?: TorrentSummary[] }>("torrents")
      .then((engine) => {
        // The watcher may have written a newer value while this call was running.
        if (engine && cache.at <= startedAt) recordActiveDownloads(engine.torrents ?? []);
      })
      .finally(() => { cache.inflight = null; });
  }
  await Promise.race([cache.inflight, new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))]);
  return cache.value;
}
