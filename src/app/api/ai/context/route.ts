import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getFacts, getFeedback, getContextProfile, saveContextInsights } from "@/lib/ai/tasteProfile";
import { buildUsageProfile } from "@/lib/ai/profile";
import { loadAiConfig } from "@/lib/ai/store";
import { buildContext } from "@/lib/ai/contextBuilder";

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
  const context = getContextProfile(user.id);

  return NextResponse.json({
    facts, liked, disliked, usage,
    context: context ? { insights: context.insights.map((i) => ({ text: i.text, confidence: i.confidence, trend: i.trend })), builtAt: context.builtAt } : null,
  });
}

/**
 * "Créer mon contexte" (demande explicite user, bouton profil) — un seul
 * appel LLM dédié qui lit l'activité réelle (vues, demandes, retours) et
 * synthétise une base de contexte durable, qui vient s'ajouter à ce que
 * l'IA sait déjà. Remplace tout contexte précédent (l'utilisateur a
 * explicitement demandé une (re)construction) — le suivi incrémental (voir
 * contextBuilder.ts) prend ensuite le relais tout seul, sans que ce bouton
 * ait besoin d'être recliqué.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = loadAiConfig();
  if (!config.enabled) return NextResponse.json({ error: "ai_disabled" }, { status: 400 });

  const insights = await buildContext(config, user.id);
  if (!insights) return NextResponse.json({ error: "build_failed" }, { status: 502 });

  saveContextInsights(user.id, insights, false);
  const context = getContextProfile(user.id)!;
  return NextResponse.json({ context: { insights: context.insights.map((i) => i.text), builtAt: context.builtAt } });
}
