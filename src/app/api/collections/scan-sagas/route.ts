import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { isSagaScanRunning, getLatestSagaScanJob, startSagaScan } from "@/lib/collections/sagaScan";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const job = getLatestSagaScanJob();
  return NextResponse.json({
    running: isSagaScanRunning(),
    scanned: job?.current ?? 0,
    total: job?.total ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSagaScanRunning()) return NextResponse.json({ running: true });
  startSagaScan();
  return NextResponse.json({ running: true });
}
