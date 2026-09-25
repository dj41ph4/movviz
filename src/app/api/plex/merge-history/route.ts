import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { mergePlexAccountHistory } from "@/lib/plex/historyMerge";

export const dynamic = "force-dynamic";

/**
 * Admin: bring a Plex server account's history (e.g. a deleted Home profile,
 * listed by GET /api/plex/accounts) into a Movviz account. Dry run unless
 * `apply: true` is sent explicitly — see historyMerge.ts for the rules.
 * Body: { fromLocalAccountId: number, toUsername: string, apply?: boolean }
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const fromLocalAccountId = Number(body?.fromLocalAccountId);
  const toUsername = typeof body?.toUsername === "string" ? body.toUsername.trim() : "";
  if (!Number.isSafeInteger(fromLocalAccountId) || fromLocalAccountId <= 0 || !toUsername) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const target = loadUsers().find((u) => u.username === toUsername);
  if (!target) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  try {
    const report = await mergePlexAccountHistory({ fromLocalAccountId, toUserId: target.id, dryRun: body?.apply !== true });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
