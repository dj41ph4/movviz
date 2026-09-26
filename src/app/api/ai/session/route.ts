import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiSession, clearAiSession, pushAiMessage, isChatActive } from "@/lib/ai/store";
import { loadAiConfig } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent, extractFacts } from "@/lib/ai/intentParser";
import { buildUserContext, buildSystemPrompt, buildProactiveNudgeTrigger, buildProactiveRatingNudgeTrigger, pickProactiveRatingCandidate } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildFeedbackContext, buildFactsContext, buildContextInsightsSection, rememberFact, getFacts, getLastProactiveRatingAskAt, markProactiveRatingAsked } from "@/lib/ai/tasteProfile";
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
  // Never into a conversation in progress (see isChatActive).
  if (isChatActive(userId)) return;
  if (!checkProactivePulse(userId)) return;

  try {
    const userContext = buildUserContext(userId);
    const memoryContext = buildMemoryContext(userId);
    const usageContext = formatUsageProfile(await buildUsageProfile(userId));
    const feedbackContext = buildFeedbackContext(userId);
    const factsContext = buildFactsContext(userId);
    const contextInsightsContext = buildContextInsightsSection(userId);
    const system = buildSystemPrompt(userContext, memoryContext, usageContext, feedbackContext, factsContext, false, false, contextInsightsContext);
    // Prefer the rating nudge over the generic opener when a real
    // watched-but-unrated candidate exists AND its own cooldown (shared
    // with the mid-conversation opportunity in chat/route.ts, so a rating
    // question is never asked twice through two different channels within
    // the same window) has elapsed. Falls back to the generic opener
    // otherwise — this is still just an opportunity, never forced.
    const RATING_NUDGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
    let triggerText = buildProactiveNudgeTrigger();
    if (Date.now() - getLastProactiveRatingAskAt(userId) > RATING_NUDGE_COOLDOWN_MS) {
      const candidate = pickProactiveRatingCandidate(userId);
      if (candidate) {
        triggerText = buildProactiveRatingNudgeTrigger(candidate);
        markProactiveRatingAsked(userId);
      }
    }
    const trigger: AiChatMessage = { role: "user", content: triggerText };
    const res = await callAi(config, system, [...session.messages, trigger]);
    const intent = parseIntent(res.text);
    if (intent.action) return; // a stray JSON reply here would be a worse UX than no nudge at all
    const { facts, cleaned } = extractFacts(intent.rawText);
    for (const fact of facts) rememberFact(userId, fact);
    if (!cleaned) return;
    // A question may have arrived while this nudge was being written.
    if (isChatActive(userId)) return;
    pushAiMessage(userId, { role: "assistant", content: cleaned });
    pendingNudges.add(userId);
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
  // Ces deux appels au modèle bloquaient la réponse (16,8 s mesurées avec un
  // fournisseur saturé) : le widget restait vide. La relance a désormais au
  // plus NUDGE_WAIT_MS pour figurer dans CETTE réponse ; au-delà elle finit
  // en arrière-plan et sera signalée au prochain GET (pendingNudges). La
  // mise à jour du contexte ne concerne pas cette réponse : jamais attendue.
  // ?sync=1 : un autre appareil a changé la conversation, ce client ne fait
  // que la relire — ni relance spontanée ni mise à jour du contexte.
  if (req.nextUrl.searchParams.get("sync") === "1") {
    return NextResponse.json({ messages: loadAiSession(user.id).messages });
  }
  void triggerIncrementalContextIfDue(user.id);
  let nudging = nudgesInFlight.get(user.id);
  if (!nudging) {
    nudging = maybeSendProactiveNudge(user.id, user.username).finally(() => nudgesInFlight.delete(user.id));
    nudgesInFlight.set(user.id, nudging);
  }
  await Promise.race([nudging, new Promise<void>((resolve) => setTimeout(resolve, NUDGE_WAIT_MS))]);
  const proactive = pendingNudges.delete(user.id);
  const config = loadAiConfig();
  return NextResponse.json({
    messages: loadAiSession(user.id).messages,
    enabled: config.enabled,
    proactive,
    // What the chat may offer: the admin turns voice on in the AI settings.
    voiceInput: config.enabled && config.voiceInputEnabled,
    voiceOutput: config.enabled && config.voiceOutputEnabled,
  });
}

const NUDGE_WAIT_MS = 1_500;
const gNudges = globalThis as typeof globalThis & {
  __movvizAiNudgesInFlight?: Map<string, Promise<void>>;
  __movvizAiPendingNudges?: Set<string>;
};
/** Une seule relance en cours par utilisateur, même si plusieurs GET arrivent. */
const nudgesInFlight: Map<string, Promise<void>> = (gNudges.__movvizAiNudgesInFlight ??= new Map());
/** Relances envoyées mais pas encore signalées au client. */
const pendingNudges: Set<string> = (gNudges.__movvizAiPendingNudges ??= new Set());

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
