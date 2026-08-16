import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { recordWatched } from "@/lib/plex/watchStore";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";

export const dynamic = "force-dynamic";

/** Direct Movviz playback tracker — records "quoi + quand" (what was watched
 *  and when) into the user's watch status, feeding the AI's recent-watches
 *  memory. Fire-and-forget from the player, never blocking playback. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = (body ?? {}) as { tmdbId?: unknown; type?: unknown; title?: unknown };
  const tmdbId = Number(b.tmdbId);
  const type = b.type;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
  if (type !== "movie" && type !== "series") return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  recordWatched(user.id, { tmdbId, type, title, at: Date.now() });
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}