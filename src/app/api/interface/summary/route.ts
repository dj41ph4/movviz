import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { activeDownloadsCount } from "@/lib/downloads/activeDownloadsCount";
import { loadNotifications } from "@/lib/notifications/store";
import { loadRequests } from "@/lib/requests/store";

export const dynamic = "force-dynamic";

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
