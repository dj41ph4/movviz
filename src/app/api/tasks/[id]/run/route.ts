import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { queueTaskRun } from "@/lib/scheduler/engine";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Manual "run now" trigger — queued through the job queue (see queueTaskRun)
 *  instead of holding the request open for the task's full duration. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = queueTaskRun((await params).id);
  return result.ok ? NextResponse.json({ queued: true }) : NextResponse.json(result, { status: 404 });
}
