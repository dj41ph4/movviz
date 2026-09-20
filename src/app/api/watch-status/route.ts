import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { syncUserWatchStatusForMedia, syncUserWatchStatusIfDue } from "@/lib/plex/watchSync";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tmdbId = Number(req.nextUrl.searchParams.get("tmdbId"));
  const type = req.nextUrl.searchParams.get("type");
  let targetedSync: Awaited<ReturnType<typeof syncUserWatchStatusForMedia>> | null = null;
  // A title page asks for its own movie. Verify that exact Plex item now,
  // instead of making a manual Plex mark wait for the global history scan or
  // its 30-minute snapshot throttle. Series remain event-driven per episode.
  if (type === "movie" && Number.isInteger(tmdbId) && tmdbId > 0) {
    try {
      targetedSync = await syncUserWatchStatusForMedia(user, { type: "movie", tmdbId });
    } catch {
      targetedSync = { status: "failed", reason: "unexpected_error" };
    }
  } else {
    // Pull this Plex profile before returning the general catalogue state.
    // The per-user gate prevents every card from triggering a full scan.
    await syncUserWatchStatusIfDue(user);
  }
  // Phase 4 du plan de finalisation (2026-09) : la réponse client vient
  // désormais de user_media_state (la vraie source de vérité), pas du
  // miroir JSON legacy — qui peut rester périmé pour des raisons qui
  // n'affectent pas SQLite. Repli JSON uniquement si le moteur de contexte
  // est indisponible (MOVVIZ_CONTEXT_ENGINE_DISABLED, ou runtime sans
  // node:sqlite) — jamais un repli silencieux vers une liste vide.
  const canonical = getCanonicalWatchStatus(user.id);
  const status = canonical ?? getWatchStatus(user.id);
  return NextResponse.json(
    { movies: status?.movies ?? [], episodes: status?.episodes ?? [], ...(targetedSync ? { targetedSync } : {}) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
