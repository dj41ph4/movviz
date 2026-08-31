import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { requestCancelJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Cancel a queued or running job — POST /api/jobs/[id]/cancel.
 * Queued jobs are removed from the queue immediately; running jobs get a
 * cooperative flag their runner polls between items (bulk searches check
 * every series/season/episode) and settle on the next checkpoint.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const ok = requestCancelJob(id);
  if (!ok) return NextResponse.json({ error: "job not found or not cancellable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
