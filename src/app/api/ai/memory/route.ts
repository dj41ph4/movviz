import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAiMemory, rememberAiEntry } from "@/lib/ai/memory";
import { buildUsageProfile } from "@/lib/ai/profile";

export const dynamic = "force-dynamic";

/** The user's visible AI memory — what the assistant knows about them
 *  (titles added through it, accepted recommendations, quantified usage).
 *  Strictly scoped to the requesting user. Feeds the chat's "I remember
 *  you" panel so the assistant's understanding is visible and grows. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memory = getAiMemory(user.id);
  return NextResponse.json({
    added: memory.added.slice(-5).reverse(),
    accepted: memory.accepted.slice(-5).reverse(),
    usage: await buildUsageProfile(user.id),
  });
}

/** Records a user interaction with the AI memory — called by the chat UI
 *  when the user adds a recommended card to the library ("accepted"). The
 *  action itself goes through the normal library routes; this only feeds
 *  the assistant's long-term per-user profile. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tmdbId = Number(body?.tmdbId);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const type = body?.type === "series" ? "series" : "movie";
  if (!tmdbId || !title || title.length > 300) {
    return NextResponse.json({ error: "tmdbId and title required" }, { status: 400 });
  }

  rememberAiEntry(user.id, "accepted", { tmdbId, title, type, at: Date.now() });
  return NextResponse.json({ ok: true });
}