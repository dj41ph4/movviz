import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getIndexCandidates, isIndexScanRunning, getLatestIndexScanJob, startIndexScan } from "@/lib/library/indexScan";

export const dynamic = "force-dynamic";

function parseType(req: NextRequest): "movie" | "series" | null {
  const t = req.nextUrl.searchParams.get("type");
  return t === "movie" || t === "series" ? t : null;
}

/** Status + results of the last (or in-progress) library-indexing scan for the given type. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const type = parseType(req);
  if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const job = getLatestIndexScanJob(type);
  return NextResponse.json({
    running: isIndexScanRunning(type),
    current: job?.current ?? 0,
    total: job?.total ?? 0,
    candidates: getIndexCandidates(type),
  });
}

/** Starts (or no-ops if already running) a scan of the library root for untracked movie/series folders. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const type = body.type === "movie" || body.type === "series" ? body.type : null;
  if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  if (isIndexScanRunning(type)) return NextResponse.json({ queued: true });
  startIndexScan(type);
  return NextResponse.json({ queued: true });
}
