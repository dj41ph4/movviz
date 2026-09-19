import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserById } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { resetBootstrapForUser } from "@/lib/plex/plexHistoryBootstrap";
import { syncUserWatchStatus } from "@/lib/plex/watchSync";

export const dynamic = "force-dynamic";

/**
 * Force Full Plex History Rescan (§22) – resets bootstrap to PENDING without
 * deleting any watched state, then triggers a sync. The next sync will do a
 * full paginated history import (reprenable) and converge canonical.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  if (!cfg.machineIdentifier) return NextResponse.json({ error: "machineIdentifier_missing" }, { status: 400 });

  const targets = userId ? [userId] : [];
  // If no userId provided, require explicit userId – never mass-reset without confirmation
  if (targets.length === 0) return NextResponse.json({ error: "userId_required" }, { status: 400 });

  for (const uid of targets) {
    const user = getUserById(uid);
    if (!user) return NextResponse.json({ error: "user_not_found", userId: uid }, { status: 404 });
    resetBootstrapForUser(uid, cfg.machineIdentifier);
  }

  // Trigger one sync per user (fire-and-forget, but await for immediate feedback)
  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];
  for (const uid of targets) {
    const user = getUserById(uid)!;
    try {
      await syncUserWatchStatus(user, { forceSnapshot: false });
      results.push({ userId: uid, ok: true });
    } catch (e) {
      results.push({ userId: uid, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
