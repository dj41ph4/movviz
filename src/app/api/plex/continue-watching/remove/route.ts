import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { removeFromContinueWatchingOnPlex } from "@/lib/plex/watchWrite";
import { clearPlaybackProgress } from "@/lib/playback/progressStore";

export const dynamic = "force-dynamic";

/**
 * "Retirer de la liste Reprendre" — Reprendre row's dropdown menu (confirmed
 * live, distinct from marking watched). An on-deck item can come from either
 * source /api/plex/on-deck reads (real Plex On Deck, or Movviz's own local
 * progressStore for the beta player) — cleared in both places since the
 * caller has no reliable way to know which one produced this specific item.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { plexRatingKey?: unknown; movvizId?: unknown } | null;
  const plexRatingKey = typeof body?.plexRatingKey === "string" ? body.plexRatingKey : null;
  const movvizId = typeof body?.movvizId === "string" ? body.movvizId : undefined;
  if (!plexRatingKey) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  clearPlaybackProgress(user.id, plexRatingKey, movvizId);
  removeFromContinueWatchingOnPlex(user, plexRatingKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
