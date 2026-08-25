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

  const engine = await engineGet<{ torrents?: TorrentSummary[] }>("torrents");
  const activeDownloads = (engine?.torrents ?? []).filter(
    (torrent) => torrent.state === "downloading" || torrent.state === "metadata",
  ).length;

  return NextResponse.json(
    { pendingRequests, pendingUsers, activeDownloads, unreadNotifications },
    { headers: { "Cache-Control": "private, no-cache" } },
  );
}
