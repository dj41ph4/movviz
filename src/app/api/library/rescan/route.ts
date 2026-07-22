import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { reconcileLibrary } from "@/lib/library/reconcile";

export const dynamic = "force-dynamic";

/** Manual "reconcile with disk" trigger — same check the scheduled task runs. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const issues = await reconcileLibrary();
  return NextResponse.json({ issues, checkedAt: Date.now() });
}
