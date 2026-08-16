import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiConfig, pushAiMessage, loadAiSession } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent } from "@/lib/ai/intentParser";
import { addMedia, recommendMedia, buildUserContext, buildSystemPrompt } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildUsageProfile, formatUsageProfile } from "@/lib/ai/profile";
import { recordAiCall } from "@/lib/ai/debugLog";
import type { AiActionOutcome, AiChatMessage, AiAddItem } from "@/lib/ai/types";

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
    else if (o.status === "not_found") lines.push(`• Introuvable sur TMDb — ${name}`);
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
    return NextResponse.json({ message: last, provider: null });
  }

  pushAiMessage(user.id, { role: "user", content: message });

  const userContext = buildUserContext(user.id);
  const memoryContext = buildMemoryContext(user.id);
  const usageContext = formatUsageProfile(buildUsageProfile(user.id));
  let system = buildSystemPrompt(userContext, memoryContext, usageContext);
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
  const assistant: AiChatMessage = { role: "assistant", content: intent.rawText || "…" };

  let itemCount: number | undefined;
  if (intent.action === "add_media" && intent.items.length) {
    const outcomes = await addMedia(user, intent.items as AiAddItem[]);
    assistant.actions = outcomes;
    const summary = summarizeAdd(outcomes);
    assistant.content = [intent.rawText, ...summary].filter(Boolean).join("\n\n");
    itemCount = outcomes.length;
    console.log(`[ai] action=add_media items=${outcomes.length} user=${user.username}`);
  } else if (intent.action === "recommend" && intent.items.length) {
    const recos = await recommendMedia(intent.items);
    const recommendations = recos.map((r, i) => ({ ...r, reason: intent.items[i]?.reason }));
    assistant.recommendations = recommendations;
    itemCount = recommendations.length;
    console.log(`[ai] action=recommend items=${recommendations.length} user=${user.username}`);
  }
  recordAiCall({
    username: user.username, kind: intent.action ?? "chat", provider: providerName,
    success: true, durationMs: latency, itemCount, message,
  });

  pushAiMessage(user.id, assistant);
  return NextResponse.json({ message: assistant, provider: providerName });
}