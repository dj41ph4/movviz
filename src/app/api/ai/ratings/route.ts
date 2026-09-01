import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAllRatings, getRating, setRating } from "@/lib/ai/tasteProfile";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import { invalidatePersonTraitCache } from "@/lib/userContext/taste";

export const dynamic = "force-dynamic";

/** Toutes les notes de l'utilisateur (panneau contexte IA + futur profil). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const tmdbIdParam = url.searchParams.get("tmdbId");
  const typeParam = url.searchParams.get("type");
  if (tmdbIdParam && (typeParam === "movie" || typeParam === "series")) {
    const tmdbId = Number(tmdbIdParam);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
    return NextResponse.json({ rating: getRating(user.id, tmdbId, typeParam) });
  }

  return NextResponse.json({ ratings: getAllRatings(user.id) });
}

/** Note explicite posée par le widget étoiles (page titre/bibliothèque) —
 *  gagne toujours sur une note déduite en conversation (voir setRating). */
export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = (body ?? {}) as { tmdbId?: unknown; type?: unknown; title?: unknown; rating?: unknown };
  const tmdbId = Number(b.tmdbId);
  const type = b.type;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  const rating = Number(b.rating);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
  if (type !== "movie" && type !== "series") return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "invalid_rating" }, { status: 400 });

  const updated = setRating(user.id, { tmdbId, type, title, rating, source: "explicit", confidence: 1 });
  invalidatePersonTraitCache(user.id);
  // Additive write-path, same fire-and-forget pattern used at every other
  // producer of real activity (watch/toggle, ai/watched, ai/feedback,
  // netflix import) — a rating is exactly the kind of signal the
  // consolidated context (profile panel) should pick up on its own,
  // without the user having to click "Régénérer le contexte" manually.
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ rating: updated });
}
