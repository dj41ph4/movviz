import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { engineGet } from "@/lib/engine/server";
import { loadNotifications } from "@/lib/notifications/store";
import { loadRequests } from "@/lib/requests/store";

export const dynamic = "force-dynamic";

interface TorrentSummary {
  state?: string;
}

// The badge only needs a count: never hold the page's shell on the engine's
// full torrent list. The last known count is returned at once and refreshed in
// the background; only the very first call waits, and only briefly.
const gActive = globalThis as typeof globalThis & { __movvizActiveDownloads?: { value: number; at: number; inflight: Promise<void> | null } };
const ACTIVE_DOWNLOADS_FRESH_MS = 5_000;
const ACTIVE_DOWNLOADS_FIRST_WAIT_MS = 1_500;
async function activeDownloadsCount(): Promise<number> {
  const cache = (gActive.__movvizActiveDownloads ??= { value: 0, at: 0, inflight: null });
  if (!cache.inflight && Date.now() - cache.at > ACTIVE_DOWNLOADS_FRESH_MS) {
    cache.inflight = engineGet<{ torrents?: TorrentSummary[] }>("torrents")
      .then((engine) => {
        if (engine) {
          cache.value = (engine.torrents ?? []).filter((torrent) => torrent.state === "downloading" || torrent.state === "metadata").length;
          cache.at = Date.now();
        }
      })
      .catch(() => {})
      .finally(() => { cache.inflight = null; });
  }
  if (cache.at === 0 && cache.inflight) await Promise.race([cache.inflight, new Promise((resolve) => setTimeout(resolve, ACTIVE_DOWNLOADS_FIRST_WAIT_MS))]);
  return cache.value;
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageRequests = user.role === "admin" || user.canManageRequests;
  const pendingRequests = loadRequests().filter(
    (request) =>
      request.status === "pending" &&
      (canManageRequests || request.userId === user.id),
  ).length;
  const pendingUsers =
    user.role === "admin"
      ? loadUsers().filter((candidate) => candidate.status === "pending").length
      : 0;
  const unreadNotifications = loadNotifications().filter((item) => !item.read).length;

  const activeDownloads = await activeDownloadsCount();

  return NextResponse.json(
    { pendingRequests, pendingUsers, activeDownloads, unreadNotifications },
    { headers: { "Cache-Control": "private, no-cache" } },
  );
}
