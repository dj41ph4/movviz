import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { syncPlexLibrary, refreshPlexLibraryFor } from "@/lib/plex/librarySync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // "Forcer la synchro" from a single title page ("en attente de
  // synchronisation Plex" — plexRatingKey not populated yet): nudge Plex's
  // own filesystem scan first (best-effort, same mechanism already used
  // right after a fresh grab lands — see librarySync.ts's doc comment)
  // instead of waiting for its own scan interval, THEN run Movviz's
  // incremental sync so it actually picks up whatever Plex just found.
  // Still an all-sections nudge (Movviz doesn't track which Plex section a
  // title lives in) — cheap either way, never a full reconcile unless the
  // caller explicitly asks for `force`.
  const nudgeType = body.nudgeType === "movie" || body.nudgeType === "series" ? body.nudgeType : null;
  if (nudgeType) {
    await refreshPlexLibraryFor(nudgeType === "series" ? "tv" : "movie");
    // Bug fix (confirmed live — a user reported the button reporting
    // success without actually fixing anything): refreshSection only tells
    // Plex to START scanning, it returns immediately while the real scan
    // runs async on Plex's side — chaining syncPlexLibrary right after used
    // to run before Plex had actually matched the file, so the "incremental"
    // pass found nothing new and the button silently no-op'd behind a
    // success toast. librarySync.ts's own scheduleLibrarySyncSoon() already
    // documents this exact race (20s wait after a fresh grab) — this is the
    // same fix, just a shorter wait since a user is actively watching a
    // spinner here rather than a background job.
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }

  const result = await syncPlexLibrary({ force: !!body.force });
  if (!result) return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  return NextResponse.json(result);
}
