import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { recordFeedback } from "@/lib/ai/tasteProfile";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";

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
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
