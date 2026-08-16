import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getFacts, getFeedback } from "@/lib/ai/tasteProfile";
import { buildUsageProfile } from "@/lib/ai/profile";

export const dynamic = "force-dynamic";

/**
 * Transparency view (requested directly: "vu qu'il construit un contexte
 * par utilisateur, j'aimerais pouvoir voir le contexte qu'il a construit")
 * — a read-only window into exactly what buildSystemPrompt() actually
 * assembles for this user, reusing the same data functions rather than a
 * separate summary that could drift from reality. Strictly scoped to the
 * requesting user (requireUser → user.id), never another account's data.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const facts = getFacts(user.id).map((f) => f.fact);
  const feedback = getFeedback(user.id);
  const liked = feedback.filter((f) => f.liked).slice(-8).map((f) => ({ title: f.title, reason: f.reason ?? null }));
  const disliked = feedback.filter((f) => !f.liked).slice(-8).map((f) => ({ title: f.title, reason: f.reason ?? null }));
  const usage = buildUsageProfile(user.id);

  return NextResponse.json({ facts, liked, disliked, usage });
}
