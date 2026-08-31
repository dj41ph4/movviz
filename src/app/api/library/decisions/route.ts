import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getDecisionLog } from "@/lib/library/decisionLog";

export const dynamic = "force-dynamic";

/** "Pourquoi Movviz a choisi ça ?" — recent automatic accept/reject decisions. Consumed by Doctor Movviz. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;
  return NextResponse.json({ decisions: getDecisionLog(limit) });
}
