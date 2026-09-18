import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { syncUserWatchStatusIfDue } from "@/lib/plex/watchSync";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Pull this exact Plex profile before returning its watched state.  This
  // replaces the former "wait for the 2-hour scheduler" behaviour while the
  // per-user gate in watchSync prevents every card from triggering a scan.
  await syncUserWatchStatusIfDue(user);
  // Phase 4 du plan de finalisation (2026-09) : la réponse client vient
  // désormais de user_media_state (la vraie source de vérité), pas du
  // miroir JSON legacy — qui peut rester périmé pour des raisons qui
  // n'affectent pas SQLite. Repli JSON uniquement si le moteur de contexte
  // est indisponible (MOVVIZ_CONTEXT_ENGINE_DISABLED, ou runtime sans
  // node:sqlite) — jamais un repli silencieux vers une liste vide.
  const canonical = getCanonicalWatchStatus(user.id);
  const status = canonical ?? getWatchStatus(user.id);
  return NextResponse.json(
    { movies: status?.movies ?? [], episodes: status?.episodes ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
