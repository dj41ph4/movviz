import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiSession, clearAiSession, pushAiMessage } from "@/lib/ai/store";
import { loadAiConfig } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent, extractFacts } from "@/lib/ai/intentParser";
import { buildUserContext, buildSystemPrompt, buildProactiveNudgeTrigger } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildFeedbackContext, buildFactsContext, buildContextInsightsSection, rememberFact, getFacts } from "@/lib/ai/tasteProfile";
import { buildUsageProfile, formatUsageProfile } from "@/lib/ai/profile";
import { checkProactivePulse } from "@/lib/ai/presence";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import type { AiChatMessage } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * Proactive nudge (demande explicite user) — a single spontaneous question
 * pushed into the session when the user genuinely comes back after a real
 * gap (presence.ts owns the cooldown/gap logic). Best-effort: any failure
 * here (LLM down, quota, a stray JSON reply) just means no nudge this time,
 * never a broken GET /api/ai/session for the widget. Fire-and-await inside
 * the request itself — no background timer, no daemon, exactly one LLM
 * call gated by a real per-user cooldown.
 */
async function maybeSendProactiveNudge(userId: string, username: string): Promise<void> {
  const config = loadAiConfig();
  if (!config.enabled) return;
  const session = loadAiSession(userId);
  // Never on a truly fresh account — that's the onboarding flow's moment
  // (actions.ts isFirstInteraction), not this one.
  if (session.messages.length === 0 && getFacts(userId).length === 0) return;
  if (!checkProactivePulse(userId)) return;

  try {
    const userContext = buildUserContext(userId);
    const memoryContext = buildMemoryContext(userId);
    const usageContext = formatUsageProfile(buildUsageProfile(userId));
    const feedbackContext = buildFeedbackContext(userId);
    const factsContext = buildFactsContext(userId);
    const contextInsightsContext = buildContextInsightsSection(userId);
    const system = buildSystemPrompt(userContext, memoryContext, usageContext, feedbackContext, factsContext, false, false, contextInsightsContext);
    const trigger: AiChatMessage = { role: "user", content: buildProactiveNudgeTrigger() };
    const res = await callAi(config, system, [...session.messages, trigger]);
    const intent = parseIntent(res.text);
    if (intent.action) return; // a stray JSON reply here would be a worse UX than no nudge at all
    const { facts, cleaned } = extractFacts(intent.rawText);
    for (const fact of facts) rememberFact(userId, fact);
    if (!cleaned) return;
    pushAiMessage(userId, { role: "assistant", content: cleaned });
    console.log(`[ai] proactive nudge sent user=${username} provider=${res.provider}`);
  } catch {
    // Best-effort — see doc comment above.
  }
}

/**
 * Incremental context top-up (demande explicite user — le profil doit
 * "évoluer progressivement" après le premier "Créer mon contexte", sans
 * jamais relancer un LLM en continu). `isIncrementalContextDue` does all the
 * real gating (requires an existing bootstrap, a real cooldown elapsed, AND
 * enough genuinely new activity — see contextBuilder.ts) so this call is a
 * near-free check on every normal request and only actually invokes the
 * model on the rare occasions the gate opens. Best-effort, same as the
 * proactive nudge above — never breaks the session response.
 */
/** Returns the user's in-memory chat session so the widget can restore its
 *  history after a navigation/remount, plus whether the AI feature is
 *  enabled at all (the widget hides itself when it isn't). May also fire a
 *  proactive nudge (see maybeSendProactiveNudge) before reading the session
 *  back, so a freshly-triggered nudge is included in THIS response — the
 *  client doesn't need a second round-trip to see it. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const before = loadAiSession(user.id).messages.length;
  await maybeSendProactiveNudge(user.id, user.username);
  await triggerIncrementalContextIfDue(user.id);
  const messages = loadAiSession(user.id).messages;
  return NextResponse.json({
    messages,
    enabled: loadAiConfig().enabled,
    proactive: messages.length > before,
  });
}

/** POST { clear: true } wipes the user's chat session (memory of past
 *  interactions stays intact — only the conversation is reset). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.clear === true) {
    clearAiSession(user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid body" }, { status: 400 });
}
