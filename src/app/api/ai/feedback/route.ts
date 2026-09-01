import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { recordFeedback, removeFeedback } from "@/lib/ai/tasteProfile";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import { invalidatePersonTraitCache } from "@/lib/userContext/taste";

export const dynamic = "force-dynamic";

/** Records a 👍/👎 on a recommendation card — the raw signal the taste
 *  engine builds on (AI.MD §2.G). Strictly scoped to the requesting user;
 *  never readable/writable for another userId. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tmdbId = Number(body?.tmdbId);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const type = body?.type === "series" ? "series" : body?.type === "movie" ? "movie" : null;
  const liked = body?.liked === true ? true : body?.liked === false ? false : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;

  if (!Number.isFinite(tmdbId) || tmdbId <= 0 || !title || title.length > 300 || !type || liked === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  recordFeedback(user.id, { tmdbId, type, title, liked, reason, at: Date.now() });
  invalidatePersonTraitCache(user.id);
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}

/** Retire un retour 👍/👎 du contexte (demande explicite — bouton "×" sur
 *  le panneau "Ce que Movviz AI sait de toi"). L'utilisateur ne veut plus
 *  qu'un vote donné (souvent posé par erreur) influence ses recommandations. */
export async function DELETE(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const tmdbId = Number(url.searchParams.get("tmdbId"));
  const type = url.searchParams.get("type");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || (type !== "movie" && type !== "series")) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  removeFeedback(user.id, tmdbId, type);
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
