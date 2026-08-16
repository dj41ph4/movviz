import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiConfig, pushAiMessage, loadAiSession } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent, extractFacts, extractSelfIntroName } from "@/lib/ai/intentParser";
import { addMedia, recommendMedia, buildUserContext, buildSystemPrompt, mapWithConcurrency, getSimilarCandidates } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildFeedbackContext, buildFactsContext, rememberFact, getFacts, hasKnownName } from "@/lib/ai/tasteProfile";
import { scoreCandidates, type MoodContext } from "@/lib/ai/recommendationScore";
import { getOrAnalyzeMoodProfile } from "@/lib/ai/titleAnalysis";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getMovie, getSeries, getCollection } from "@/lib/metadata/tmdb";
import { buildUsageProfile, formatUsageProfile } from "@/lib/ai/profile";
import { recordAiCall } from "@/lib/ai/debugLog";
import type { AiActionOutcome, AiChatMessage, AiAddItem, AiMoodCategories } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

function summarizeAdd(outcomes: AiActionOutcome[]): string[] {
  const counts = { added: 0, already: 0, requested: 0, not_found: 0, blocked: 0, error: 0 };
  for (const o of outcomes) counts[o.status]++;
  const lines: string[] = [];
  const total = outcomes.length;
  if (counts.added || counts.requested) {
    lines.push(`Ajout ${total > 1 ? "de " + total + " titres" : "du titre"} — les recherches démarrent automatiquement en arrière-plan.`);
  }
  for (const o of outcomes) {
    const name = o.year ? `${o.title} (${o.year})` : o.title;
    if (o.status === "added") lines.push(`• Ajouté, recherche lancée — ${name}`);
    else if (o.status === "requested") lines.push(`• Demande envoyée — ${name}`);
    else if (o.status === "already") lines.push(`• Déjà dans la bibliothèque — ${name}`);
    else if (o.status === "not_found") lines.push(`• Introuvable ou pas de correspondance fiable sur TMDb — ${name} (essaie avec l'année ou le titre original si tu le connais)`);
    else if (o.status === "blocked") lines.push(`• Non autorisé (règle existante) — ${name}`);
    else if (o.status === "error") lines.push(`• Échec — ${name}${o.detail && o.detail !== "quota_reached" ? ` (${o.detail})` : ""}`);
  }
  return lines;
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = loadAiConfig();
  if (!config.enabled) return NextResponse.json({ error: "ai_disabled" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  // Page context comes from the CLIENT (the chat widget reads the browser
  // store written by the title page) — the server keeps no notion of "what
  // the user is looking at".
  const pageCtx = body?.pageContext;
  const pageContext = pageCtx && typeof pageCtx === "object" &&
    Number.isFinite(Number(pageCtx.tmdbId)) &&
    (pageCtx.type === "movie" || pageCtx.type === "series") &&
    typeof pageCtx.title === "string" && pageCtx.title.length > 0 && pageCtx.title.length <= 200
    ? { tmdbId: Number(pageCtx.tmdbId), type: pageCtx.type as "movie" | "series", title: pageCtx.title }
    : null;

  const session = loadAiSession(user.id);
  const last = session.messages[session.messages.length - 1];
  if (last?.role === "user" && last.content === message) {
    // Bug fix (audit finding #7, confirmed live): this used to return
    // `last` itself — a role:"user" message — to a client that always
    // expects an assistant reply in this shape (ChatWidget.sendText just
    // appends whatever comes back with no role check). A rapid double-
    // submit landing here produced a second right-aligned user bubble with
    // no visible reply, reading exactly like the bot ignored the message.
    // Re-serve the real assistant reply to this exact message if one
    // already exists; if not (very first message duplicated before any
    // reply landed), fall through and process normally instead of
    // echoing the user's own text back as if it were the answer.
    const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) return NextResponse.json({ message: lastAssistant, provider: null });
  }
  // Captured BEFORE pushAiMessage below — loadAiSession returns the SAME
  // mutable session object every time (in-process store), so checking
  // session.messages.length AFTER the push would always see the message
  // that was just added and never detect a first-ever interaction.
  const wasEmptySession = session.messages.length === 0;

  pushAiMessage(user.id, { role: "user", content: message });

  // Bug fix (audit finding #5, confirmed live — same class as the brique-9
  // fix, just relocated): this MUST be read before extractSelfIntroName's
  // rememberFact() below mutates the facts store, or a genuinely first-ever
  // message that happens to be a self-introduction ("Salut, je m'appelle
  // Seb") would already show 1 fact by the time isFirstInteraction is
  // computed, silently skipping onboarding for exactly the user who
  // volunteered their name upfront.
  const hadNoFactsBefore = getFacts(user.id).length === 0;

  // Reliable, code-level capture of the single most common durable fact —
  // never depends on the model choosing to emit a [[FAIT: ...]] marker for
  // it (small/free-tier models don't always follow that instruction).
  const introName = extractSelfIntroName(message);
  if (introName) rememberFact(user.id, introName);

  const userContext = buildUserContext(user.id);
  const memoryContext = buildMemoryContext(user.id);
  const usageContext = formatUsageProfile(buildUsageProfile(user.id));
  const feedbackContext = buildFeedbackContext(user.id);
  const factsContext = buildFactsContext(user.id);
  // "First ever interaction" = no prior session AND no fact known about
  // this user BEFORE this message — not just "empty session" (a cleared
  // chat shouldn't re-trigger onboarding for someone Movviz already knows).
  const isFirstInteraction = wasEmptySession && hadNoFactsBefore;
  // Checked AFTER the introName capture above, so telling it your name IN
  // THIS message already counts — no double-ask in the same reply.
  const needsName = !hasKnownName(user.id);
  let system = buildSystemPrompt(userContext, memoryContext, usageContext, feedbackContext, factsContext, isFirstInteraction, needsName);
  if (pageContext) {
    system += `\n\nRÉFÉRENCE COURANTE — l'utilisateur regarde actuellement ${pageContext.type === "movie" ? "le film" : "la série"} « ${pageContext.title} » (${pageContext.tmdbId}). Quand il dit « dans le même genre », « quelque chose comme ça », « moins sérieux »…, c'est CE titre qui est la référence.`;
  }

  const t0 = Date.now();
  let providerName = "";
  let text: string;
  try {
    const res = await callAi(config, system, session.messages);
    text = res.text;
    providerName = res.provider;
  } catch (e) {
    const err = e as { message?: string; provider?: string; quota?: boolean };
    console.log(`[ai] chat fail user=${user.username} provider=${err.provider ?? "?"} quota=${!!err.quota} err=${err.message ?? "?"}`);
    recordAiCall({
      username: user.username, kind: "chat", provider: err.provider ?? null,
      success: false, durationMs: Date.now() - t0, error: err.message ?? "?", message,
    });
    return NextResponse.json({ error: "ai_call_failed", detail: err.message ?? null }, { status: 502 });
  }
  const latency = Date.now() - t0;
  const usedModel = (config.providers as Record<string, { model?: string }>)[providerName]?.model ?? "?";
  console.log(`[ai] chat ok user=${user.username} provider=${providerName} model=${usedModel} latency=${latency}ms`);

  const intent = parseIntent(text);
  const { facts, cleaned } = extractFacts(intent.rawText);
  for (const fact of facts) rememberFact(user.id, fact);
  // A bare "…" here (the old fallback) reads as broken, not thoughtful —
  // this branch only fires when the model's ENTIRE reply was [[FAIT:...]]
  // marker lines with no actual sentence (a prompt-following miss on the
  // model's part, now discouraged more explicitly in buildSystemPrompt).
  const assistant: AiChatMessage = { role: "assistant", content: cleaned || "D'accord !" };

  let itemCount: number | undefined;
  if (intent.action === "add_media" && intent.items.length) {
    const outcomes = await addMedia(user, intent.items as AiAddItem[]);
    assistant.actions = outcomes;
    const summary = summarizeAdd(outcomes);
    assistant.content = [cleaned, ...summary].filter(Boolean).join("\n\n");
    itemCount = outcomes.length;
    console.log(`[ai] action=add_media items=${outcomes.length} user=${user.username}`);
  } else if (intent.action === "recommend" && intent.items.length) {
    const pairs = await recommendMedia(intent.items);
    // The LLM is prompted to over-generate candidates (buildSystemPrompt) —
    // Movviz does the actual ranking/filtering here (AI.MD §2.D/§2.E), not
    // the model.
    const reasons = new Map(pairs.map((p) => [`${p.item.type}:${p.item.tmdbId}`, p.source.reason]));
    let allItems = pairs.map((p) => p.item);

    // Candidate Engine, source #2 (AI.MD §2.D) — TMDb's own "similar to X"
    // catalog data, added alongside the LLM's picks rather than instead of
    // them. Only when there's a clear reference (the page the user is on):
    // TMDb's recommendations are FOR a specific title, there's no sane
    // reference-less version of this. A generic reason is attached since
    // these weren't proposed by the model — never invents one for TMDb's
    // pick, just names the mechanism honestly.
    if (pageContext) {
      const exclude = new Set(allItems.map((i) => `${i.type}:${i.tmdbId}`));
      exclude.add(`${pageContext.type}:${pageContext.tmdbId}`);
      const similar = await getSimilarCandidates(pageContext.type, pageContext.tmdbId, exclude, 8);
      for (const s of similar) {
        reasons.set(`${s.type}:${s.tmdbId}`, `Similaire à « ${pageContext.title} » selon TMDb`);
      }
      allItems = [...allItems, ...similar];
    }

    // Mood Engine (AI.MD §2.B/C) — only when there's a clear reference title
    // (the page the user is currently on): analyzing/comparing mood for a
    // recommendation with no anchor at all wouldn't mean anything. Every
    // analysis call here is cache-first (titleAnalysis.ts) — the LLM is only
    // actually invoked the FIRST time a given title is ever seen.
    let mood: MoodContext | undefined;
    // FranchiseAffinity (§2.E) — same TMDb collection as the reference.
    // Cheap by construction: getCollection() returns every part's tmdbId in
    // ONE call, so no per-candidate fetch is needed (the earlier "too
    // costly" assessment was for a per-candidate collectionId lookup, which
    // this sidesteps entirely). Movies only — TMDb collections don't exist
    // for series.
    let franchiseTmdbIds: Set<number> | undefined;
    if (pageContext) {
      const refDetail = pageContext.type === "movie" ? await getMovie(pageContext.tmdbId) : await getSeries(pageContext.tmdbId);
      const refProfile = refDetail
        ? await getOrAnalyzeMoodProfile(config, pageContext.type, pageContext.tmdbId, pageContext.title, refDetail.overview, refDetail.genres)
        : null;
      if (refProfile) {
        const candidateMoods = new Map<string, AiMoodCategories>();
        await mapWithConcurrency(allItems, 3, async (item) => {
          const profile = await getOrAnalyzeMoodProfile(config, item.type, item.tmdbId, item.title, item.overview);
          if (profile) candidateMoods.set(`${item.type}:${item.tmdbId}`, profile.categories);
        });
        mood = { reference: refProfile.categories, candidates: candidateMoods };
      }
      if (pageContext.type === "movie" && refDetail && "collectionId" in refDetail && refDetail.collectionId) {
        const collection = await getCollection(refDetail.collectionId).catch(() => null);
        if (collection) franchiseTmdbIds = new Set(collection.parts.map((p) => p.tmdbId));
      }
    }

    // TasteCompatibility (§2.H) — independent of pageContext: it's built
    // purely from the user's own past 👍/👎 log + whatever those titles'
    // Mood Engine profiles already are (cache-only lookup, no new LLM
    // call), so it applies whenever there IS a candidate mood profile to
    // compare against — which today means whenever the mood term above
    // also ran, since that's what populates candidate profiles.
    const tasteVector = buildTasteVector(user.id);

    const recommendations = scoreCandidates(user.id, allItems, reasons, 6, mood, tasteVector, franchiseTmdbIds)
      .map((r) => ({ ...r, reason: reasons.get(`${r.type}:${r.tmdbId}`) }));
    assistant.recommendations = recommendations;
    itemCount = recommendations.length;
    console.log(`[ai] action=recommend candidates=${allItems.length} (llm=${pairs.length}) shown=${recommendations.length} mood=${!!mood} user=${user.username}`);
  }
  recordAiCall({
    username: user.username, kind: intent.action ?? "chat", provider: providerName,
    success: true, durationMs: latency, itemCount, message,
  });

  pushAiMessage(user.id, assistant);
  return NextResponse.json({ message: assistant, provider: providerName });
}