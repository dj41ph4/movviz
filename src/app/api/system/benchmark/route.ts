import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { readServerBenchmark, runServerBenchmark } from "@/lib/playback/engine/serverBenchmark";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ result: readServerBenchmark() });
}

// The scheduler's generic /api/tasks/server-benchmark/run also runs this
// same runServerBenchmark() (see scheduler/tasks.ts) but only reports back
// generic run/duration metadata via the Automatisation panel — this direct
// route holds the request open for the real result (profiles, realtime
// factors) so the dedicated Performance → Benchmark panel can show it
// immediately instead of a second round-trip through readServerBenchmark().
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await runServerBenchmark();
  return NextResponse.json({ result });
}
