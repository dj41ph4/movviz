import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { readServerBenchmark } from "@/lib/playback/engine/serverBenchmark";
import { activeJobForSource } from "@/lib/jobs/queue";
import { queueTaskRun } from "@/lib/scheduler/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const job = activeJobForSource("server-benchmark");
  return NextResponse.json({ result: readServerBenchmark(), state: job?.status ?? null });
}

// The Performance button uses the same low-priority heavy queue as the
// automatic triggers. A 202 lets the panel show the queued state without
// holding an HTTP request open through playback or other background work.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const queued = queueTaskRun("server-benchmark");
  if (!queued.ok) return NextResponse.json({ error: queued.error }, { status: 500 });
  return NextResponse.json({ queued: true }, { status: 202 });
}
