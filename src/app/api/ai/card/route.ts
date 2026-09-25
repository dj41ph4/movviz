import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { replaceRecommendationCard } from "@/lib/ai/store";
import { getSeenKeys, markSeen, type SeenKey } from "@/lib/ai/seen";
import { recordFeedback } from "@/lib/ai/tasteProfile";
import { invalidatePersonTraitCache } from "@/lib/userContext/taste";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";

export const dynamic = "force-dynamic";

/**
 * Action on a recommendation card, shared by the web chat and the mobile app:
 * « Déjà vu » (marked watched) or « Pas pour moi » (👎, never proposed
 * again). Either way the card is swapped for the next best-ranked one kept
 * with the message — no new call to the model.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "seen" || body?.action === "dislike" ? (body.action as "seen" | "dislike") : null;
  const tmdbId = Number(body?.tmdbId);
  const type = body?.type === "movie" || body?.type === "series" ? (body.type as "movie" | "series") : null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;
  if (!action || !Number.isInteger(tmdbId) || tmdbId <= 0 || !type || !title) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (action === "seen") {
    markSeen(user.id, { tmdbId, type, title });
  } else {
    recordFeedback(user.id, { tmdbId, type, title, liked: false, reason, at: Date.now() });
    invalidatePersonTraitCache(user.id);
    triggerIncrementalContextIfDue(user.id).catch(() => {});
  }
  // An alternate may have been marked seen since (through another card).
  const seen = getSeenKeys(user.id);
  let replacement = replaceRecommendationCard(user.id, type, tmdbId);
  while (replacement && seen.has(`${replacement.type}:${replacement.tmdbId}` as SeenKey)) {
    replacement = replaceRecommendationCard(user.id, replacement.type, replacement.tmdbId);
  }
  return NextResponse.json({ ok: true, replacement });
}
