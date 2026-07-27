import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { findUpgradeCandidates } from "@/lib/library/searchAndReplace";

export const dynamic = "force-dynamic";

/** Read-only — never grabs anything. See searchAndReplace.ts for the comparison logic. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const candidates = await findUpgradeCandidates();
  return NextResponse.json({ candidates });
}
