import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { runDoctorAnalysis } from "@/lib/doctor/analyze";

export const dynamic = "force-dynamic";

/** On-demand only — never polled automatically (indexer tests + engine ping have a real cost). */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const report = await runDoctorAnalysis();
  return NextResponse.json(report);
}
