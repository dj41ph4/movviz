import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { scanRepairCandidates, applyRepairs } from "@/lib/library/repairPaths";
import type { RepairSelection } from "@/lib/library/repairPaths";

export const dynamic = "force-dynamic";

/** GET — scans for library records whose file is missing and proposes a relink by filename. Read-only, no filesystem writes. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const candidates = await scanRepairCandidates();
  return NextResponse.json({ candidates });
}

/** POST — applies the confirmed relinks (metadata only, never moves or deletes a file). */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const selections = body.selections as RepairSelection[] | undefined;
  if (!Array.isArray(selections) || selections.length === 0) {
    return NextResponse.json({ error: "No selections provided" }, { status: 400 });
  }
  const result = applyRepairs(selections);
  return NextResponse.json(result);
}
