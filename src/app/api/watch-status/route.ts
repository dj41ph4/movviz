import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { syncUserWatchStatusIfDue } from "@/lib/plex/watchSync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Pull this exact Plex profile before returning its watched state.  This
  // replaces the former "wait for the 2-hour scheduler" behaviour while the
  // per-user gate in watchSync prevents every card from triggering a scan.
  await syncUserWatchStatusIfDue(user);
  const status = getWatchStatus(user.id);
  return NextResponse.json(
    { movies: status?.movies ?? [], episodes: status?.episodes ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
