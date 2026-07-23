import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getRequest, updateRequest } from "@/lib/requests/store";
import { addMovieToLibrary } from "@/lib/library/autoGrab";
import { addSeriesToLibrary } from "@/lib/library/autoGrabSeries";
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

  const result =
    request.type === "series" ? await addSeriesToLibrary(request.tmdbId, undefined, request.seasonNumbers) : await addMovieToLibrary(request.tmdbId);
  updateRequest(request.id, { status: "approved", decidedAt: Date.now(), decidedBy: admin.username });

  if ("error" in result) return NextResponse.json(result, { status: 502 });
  const item = "movie" in result ? result.movie : result.series;
  emitNotification("request_approved", `${request.title} — demande approuvée`, "/requests", { title: request.title });
  logActivity("approved", admin.username, request.title, "/requests");
  return NextResponse.json({ ok: true, item, searchResult: result.searchResult });
}
