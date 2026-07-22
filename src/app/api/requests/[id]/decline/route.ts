import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getRequest, updateRequest } from "@/lib/requests/store";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireUser(req);
  if (!admin || (admin.role !== "admin" && !admin.canManageRequests)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const request = getRequest((await params).id);
  if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (request.status !== "pending") return NextResponse.json({ error: "already_decided" }, { status: 400 });

  const updated = updateRequest(request.id, { status: "declined", decidedAt: Date.now(), decidedBy: admin.username });
  emitNotification("request_declined", `${request.title} — demande refusée`, "/requests", { title: request.title });
  logActivity("declined", admin.username, request.title, "/requests");
  return NextResponse.json({ ok: true, request: updated });
}
