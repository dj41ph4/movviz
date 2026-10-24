import type { EngineTorrent } from "@/lib/types";

type Snapshot = { torrents: EngineTorrent[]; updatedAt: number };

const g = globalThis as typeof globalThis & { __movvizQueueSnapshot?: Snapshot };

/** Keep the last verified engine reply so a temporary timeout cannot erase the queue. */
export function resolveQueueSnapshot(payload: unknown, now = Date.now()): {
  torrents: EngineTorrent[];
  stale: boolean;
  updatedAt: number;
} | null {
  const torrents = (payload as { torrents?: unknown } | null)?.torrents;
  if (Array.isArray(torrents)) {
    g.__movvizQueueSnapshot = { torrents: torrents as EngineTorrent[], updatedAt: now };
    return { torrents: torrents as EngineTorrent[], stale: false, updatedAt: now };
  }
  const previous = g.__movvizQueueSnapshot;
  return previous ? { ...previous, stale: true } : null;
}
