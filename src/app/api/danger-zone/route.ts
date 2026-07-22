import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { clearMovies, clearSeries } from "@/lib/library/store";
import { clearActivity, logActivity } from "@/lib/activity/store";
import { clearNotifications } from "@/lib/notifications/store";
import { clearRequests } from "@/lib/requests/store";
import { clearIssues } from "@/lib/issues/store";
import { resetSyncState } from "@/lib/plex/syncState";

export const dynamic = "force-dynamic";

/**
 * Irreversible bulk-wipe actions on Movviz's own database only — never
 * touches Plex, the download client, or files on disk. Meant for a clean
 * restart before a fresh Plex resync (e.g. after test data or a bad import).
 */
const ACTIONS: Record<string, () => void> = {
  clearMovies,
  clearSeries,
  clearActivity,
  clearNotifications,
  clearRequests,
  clearIssues,
  resetPlexSyncState: resetSyncState,
};

export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { action } = await req.json();
  const run = ACTIONS[action];
  if (!run) return NextResponse.json({ error: "unknown action" }, { status: 400 });

  run();
  logActivity("removed", user.username, `Danger zone: ${action}`, null);
  return NextResponse.json({ ok: true });
}
