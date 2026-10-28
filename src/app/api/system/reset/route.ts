import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** The configuration root can also contain media (notably on NAS and native
 * installs). A recursive reset is unsafe until all stores and the live engine
 * can be reset without deleting or recreating user data. Fail closed. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "safe_reset_unavailable" }, { status: 503 });
}
