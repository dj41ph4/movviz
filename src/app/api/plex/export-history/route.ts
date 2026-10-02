import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { queuePlexWatchHistoryExport } from "@/lib/plex/historyExport";

export const dynamic = "force-dynamic";

/** Deliberate export of one Movviz profile's watched state to its own Plex
 * identity. Dry run by default; no implicit export of other profiles. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const user = loadUsers().find((u) => u.username === body?.username);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  try {
    const report = await queuePlexWatchHistoryExport(user.id, body?.apply === true);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "export_failed" }, { status: 409 });
  }
}
