import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiConfig, pushAiMessage, loadAiSession } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent, extractFacts, extractWatched, extractSelfIntroName, extractNameFromDirectAnswer, detectLibraryFalseNegativeCorrection, extractMissingFromEntity, extractLibraryPresenceQuestion, extractWatchStatusQuestion, extractCastCrewQuestion, extractSeriesStatusQuestion, isSeriesStatusAboutCurrentPage, isDegenerateReply, containsLeakedInternalBlock, sanitizeLeakedBlock, isFalseNameDenial } from "@/lib/ai/intentParser";
import { addMedia, recommendMedia, buildUserContext, buildSystemPrompt, mapWithConcurrency, getSimilarCandidates, resolveAiItem, isEpisodeListRequest, buildEpisodeListContext, buildMissingFromFranchiseContext, MAX_FRANCHISE_HITS, buildLibraryPresenceContext, buildWatchStatusContext, buildCastCrewContext, buildTitleStatusContext, type FranchiseSearchHit, type WatchStatusResult, type TitleRef } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildFeedbackContext, buildFactsContext, buildContextInsightsSection, buildCorrectionEscalationContext, recordCorrection, rememberFact, getFacts, hasKnownName } from "@/lib/ai/tasteProfile";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import { scoreCandidates, isSeriesFullyWatched, type MoodContext, type FranchiseContext, type FatigueContext } from "@/lib/ai/recommendationScore";
import { getOrAnalyzeMoodProfile, getCachedMoodProfile } from "@/lib/ai/titleAnalysis";
import { buildTasteVector, averageProfiles } from "@/lib/ai/contrastiveProfile";
import { getMovie, getSeries, getDetail, getCollection, searchMulti } from "@/lib/metadata/tmdb";
import { resolveTitleAgainstTmdb } from "@/lib/metadata/resolveTitle";
import { buildUsageProfile, formatUsageProfile } from "@/lib/ai/profile";
import { getWatchStatus, setWatchedMovies, recordWatched } from "@/lib/plex/watchStore";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getOrFetchScene } from "@/lib/ai/sceneCache";
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
  // Bug fix (confirmed live): a bare one-word reply ("Seb") to the
  // assistant's own "comment tu t'appelles ?" matched neither
  // extractSelfIntroName's sentence patterns nor a [[FAIT:...]] marker —
  // the fact never got stored, needsName stayed true forever, and the
  // model (still "seeing" the name in its own session history) produced a
  // self-contradictory reply ("tu ne m'as pas donné ton prénom... Seb !").
  // previousAssistant = the turn right before the user message just
  // pushed above (session.messages now ends [...,assistant,user]).
  const previousAssistant = session.messages[session.messages.length - 2];
  const introName = extractSelfIntroName(message)
    ?? extractNameFromDirectAnswer(previousAssistant?.role === "assistant" ? previousAssistant.content : undefined, message);
  if (introName) rememberFact(user.id, introName);

  // Correction-detection (confirmed live bug: "il me manque quoi de X" →
  // invented absence → user corrects it, but the assistant never actually
  // learns from it beyond that one apology). Code-level, deterministic —
  // never trusts the LLM's own judgment of whether it was wrong (see
  // intentParser.detectLibraryFalseNegativeCorrection doc).
  const libraryCorrectionNote = detectLibraryFalseNegativeCorrection(previousAssistant?.role === "assistant" ? previousAssistant.content : undefined, message);
  if (libraryCorrectionNote) {
    recordCorrection(user.id, { category: "library_false_negative", note: libraryCorrectionNote });
    // Additive write-path, same fire-and-forget pattern used at every other
    // call site (watch/toggle, ai/watched, ai/feedback, netflix import) —
    // not a new mechanism, just one more producer of "real activity".
    triggerIncrementalContextIfDue(user.id).catch(() => {});
  }

  const userContext = buildUserContext(user.id);
  const memoryContext = buildMemoryContext(user.id);
  const usageContext = formatUsageProfile(buildUsageProfile(user.id));
  const feedbackContext = buildFeedbackContext(user.id);
  const factsContext = buildFactsContext(user.id);
  const contextInsightsContext = buildContextInsightsSection(user.id);
  const correctionEscalationContext = buildCorrectionEscalationContext(user.id);
  // "First ever interaction" = no prior session AND no fact known about
  // this user BEFORE this message — not just "empty session" (a cleared
  // chat shouldn't re-trigger onboarding for someone Movviz already knows).
  const isFirstInteraction = wasEmptySession && hadNoFactsBefore;
  // Checked AFTER the introName capture above, so telling it your name IN
  // THIS message already counts — no double-ask in the same reply.
  const needsName = !hasKnownName(user.id);
  let system = buildSystemPrompt(userContext, memoryContext, usageContext, feedbackContext, factsContext, isFirstInteraction, needsName, contextInsightsContext, correctionEscalationContext);

  // "Qu'est-ce qu'il me manque de X" (franchise/acteur/réalisateur) —
  // confirmed live TWICE (Jeremy Ferrari, then Pokémon) that the prompt-only
  // honesty rule above isn't reliably followed by a small/free-tier model:
  // it invented an absence ("aucun film Pokémon dans ta bibliothèque") the
  // user then had to correct. Code-level detection + a REAL TMDb search
  // cross-checked against the real library, injected only for this one
  // message — never on every message (real network call, kept gated behind
  // extractMissingFromEntity's narrow regex match).
  const missingFromEntity = extractMissingFromEntity(message);
  if (missingFromEntity) {
    try {
      const searchRes = await searchMulti(missingFromEntity, 1);
      const hits: FranchiseSearchHit[] = searchRes.results.slice(0, MAX_FRANCHISE_HITS).map((r) => ({
        title: r.title,
        year: r.year ?? undefined,
        type: r.type,
        tmdbId: r.tmdbId,
        inLibrary: r.type === "movie" ? !!getMovieByTmdbId(r.tmdbId) : !!getSeriesByTmdbId(r.tmdbId),
      }));
      if (hits.length) system += buildMissingFromFranchiseContext(missingFromEntity, hits);
    } catch {
      // Best-effort — a TMDb failure here just means no RECHERCHE RÉELLE
      // block gets injected; the honesty-rule fallback in buildSystemPrompt
      // is the safety net for exactly this case.
    }
  }

  // The 4 "single title question" shapes below (items 1-4 of this session's
  // brief) — each gated strictly behind its own narrow regex, each injecting
  // its OWN separate "VÉRIFICATION RÉELLE" block so a message that triggers
  // only one of them never also drags the others into the prompt. All real
  // network calls (TMDb search/detail) only happen when the corresponding
  // detector actually matched this message — same discipline as the
  // franchise-search block above.

  // Item 2 (watch status) is checked BEFORE item 1 (presence) — "j'ai vu X"
  // is the more specific shape and must never also read as a bare "j'ai X"
  // presence question (extractLibraryPresenceQuestion's own regex already
  // excludes "vu"/"regardé", but checking watch status first keeps the two
  // blocks cleanly separate regardless).
  const watchStatusTitle = extractWatchStatusQuestion(message);
  if (watchStatusTitle) {
    try {
      const resolved = await resolveTitleAgainstTmdb({ title: watchStatusTitle });
      let result: WatchStatusResult | null = null;
      let recentAt: number | undefined;
      if (resolved) {
        const status = getWatchStatus(user.id);
        if (resolved.type === "movie") {
          result = status?.movies.includes(resolved.tmdbId) ? "watched" : "not_watched";
        } else {
          const episodeKeys = new Set((status?.episodes ?? []).filter((e) => e.tmdbId === resolved.tmdbId).map((e) => `${e.season}.${e.episode}`));
          result = episodeKeys.size === 0 ? "not_watched" : isSeriesFullyWatched(resolved.tmdbId, episodeKeys) ? "watched" : "partially_watched";
        }
        recentAt = status?.recent?.find((r) => r.tmdbId === resolved.tmdbId && r.type === resolved.type)?.at;
      }
      system += buildWatchStatusContext(watchStatusTitle, resolved, result, recentAt);
    } catch {
      // Best-effort — same safety net as the franchise-search block: no
      // block gets injected, the honesty rule tells the model to admit it
      // can't verify rather than guess.
    }
  }

  // Item 1 (library presence) — the flagship case from this session's brief
  // ("Est-ce que j'ai Alien ?"). resolveTitleAgainstTmdb already computes
  // `inLibrary` against the real library as part of resolution, so no
  // separate store lookup is needed here.
  const presenceTitle = extractLibraryPresenceQuestion(message);
  if (presenceTitle) {
    try {
      const resolved = await resolveTitleAgainstTmdb({ title: presenceTitle });
      system += buildLibraryPresenceContext(presenceTitle, resolved);
    } catch {
      // Best-effort, see comment above.
    }
  }

  // Item 3 (cast/crew) — Movviz previously injected ZERO cast/crew data;
  // any answer came purely from the model's training memory (a real
  // wrong-actor/wrong-movie hallucination risk). getDetail already fetches
  // credits via append_to_response in ONE call (same convention as every
  // other detail fetch in tmdb.ts) and is cache-first like all TMDb calls.
  const castCrewTitle = extractCastCrewQuestion(message);
  if (castCrewTitle) {
    try {
      const resolved = await resolveTitleAgainstTmdb({ title: castCrewTitle });
      let cast: { name: string; character: string }[] = [];
      let crew: { name: string; job: string }[] = [];
      if (resolved) {
        const detail = await getDetail(resolved.type, resolved.tmdbId);
        cast = detail?.cast ?? [];
        crew = detail?.crew ?? [];
      }
      system += buildCastCrewContext(castCrewTitle, resolved, cast, crew);
    } catch {
      // Best-effort, see comment above.
    }
  }

  // Item 4 (production status) — either an explicit title ("est-ce que X
  // est fini ?") or an implicit reference to whatever the user is currently
  // looking at ("cette série est-elle terminée ?", only resolvable when
  // pageContext is actually present and is a series/movie page).
  const statusTitle = extractSeriesStatusQuestion(message);
  const statusIsCurrentPage = !statusTitle && !!pageContext && isSeriesStatusAboutCurrentPage(message);
  if (statusTitle || statusIsCurrentPage) {
    try {
      const query = statusTitle ?? pageContext!.title;
      let resolved: TitleRef | null;
      if (statusTitle) {
        resolved = await resolveTitleAgainstTmdb({ title: statusTitle });
      } else {
        resolved = { title: pageContext!.title, type: pageContext!.type, tmdbId: pageContext!.tmdbId };
      }
      const status = resolved ? (await getDetail(resolved.type, resolved.tmdbId))?.status ?? null : null;
      system += buildTitleStatusContext(query, resolved, status);
    } catch {
      // Best-effort, see comment above.
    }
  }

  if (pageContext) {
    system += `\n\nRÉFÉRENCE COURANTE — l'utilisateur regarde actuellement ${pageContext.type === "movie" ? "le film" : "la série"} « ${pageContext.title} » (${pageContext.tmdbId}). Quand il dit « dans le même genre », « quelque chose comme ça », « moins sérieux »…, c'est CE titre qui est la référence.`;

    // Liste d'épisodes (demande explicite user — confirmé en direct que
    // l'IA n'avait aucune donnée réelle pour répondre à ça). Détection
    // côté code (pas laissée à l'appréciation du modèle), injectée
    // UNIQUEMENT quand vraiment demandé — jamais à chaque message sur une
    // fiche série, pour ne pas gonfler le prompt inutilement.
    if (pageContext.type === "series" && isEpisodeListRequest(message)) {
      const series = getSeriesByTmdbId(pageContext.tmdbId);
      if (series) {
        const watchedKeys = new Set((getWatchStatus(user.id)?.episodes ?? []).filter((e) => e.tmdbId === pageContext.tmdbId).map((e) => `${e.season}.${e.episode}`));
        system += buildEpisodeListContext(series, watchedKeys);
      }
    }

    // Scène mémorable (demande explicite user, Mistral web_search UNIQUEMENT
    // — voir sceneCache.ts/providers.ts). Seulement pour un titre CONFIRMÉ
    // vu (jamais pour un titre juste consulté) — cache-first, donc coût
    // réel seulement la toute première fois que ce titre est référencé,
    // tous utilisateurs confondus. La règle "SCÈNE MÉMORABLE" (actions.ts)
    // décide seule si/comment l'utiliser ; ceci ne fait que fournir la
    // matière première trouvée sur le web, jamais une instruction de l'imposer.
    if (config.webSearchEnabled) {
      const watchStatus = getWatchStatus(user.id);
      const confirmedWatched = pageContext.type === "movie"
        ? (watchStatus?.movies ?? []).includes(pageContext.tmdbId)
        : (watchStatus?.episodes ?? []).some((e) => e.tmdbId === pageContext.tmdbId);
      if (confirmedWatched) {
        const scene = await getOrFetchScene(config, pageContext.type, pageContext.tmdbId, pageContext.title);
        if (scene) {
          system += `\n\nSCÈNES TROUVÉES VIA RECHERCHE WEB pour « ${pageContext.title} » (Mistral web_search, à utiliser seulement si pertinent et seulement selon la règle SCÈNE MÉMORABLE ci-dessus — ignore complètement si ça ne sert pas ce message précis) :\n${scene.findings}`;
        }
      }
    }
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
  const { facts, cleaned: afterFacts } = extractFacts(intent.rawText);
  for (const fact of facts) rememberFact(user.id, fact);
  const { watched, cleaned } = extractWatched(afterFacts);
  if (watched.length) {
    // Best-effort — the same TMDb title matching add_media already trusts
    // (resolveAiItem, titleSimilarity-gated), never a raw title/tmdbId pair
    // taken from the model. A resolution miss just means this one title
    // isn't recorded, never a broken chat reply.
    for (const w of watched) {
      try {
        const resolved = await resolveAiItem({ title: w.title, type: w.type });
        if (!resolved) continue;
        if (resolved.type === "movie") setWatchedMovies(user.id, [resolved.tmdbId], true, resolved.title);
        else recordWatched(user.id, { tmdbId: resolved.tmdbId, type: "series", title: resolved.title, at: Date.now() });
      } catch {
        // best-effort, see comment above
      }
    }
  }
  // Bug fix (confirmed live via two screenshots): when the model's ENTIRE
  // mode-3 reply was `[[FAIT:...]]`/`[[VU:...]]` marker lines with no real
  // sentence, `cleaned` comes back empty — the old fallback ("D'accord !")
  // then landed as a bizarre non-answer to a direct question or callout
  // ("tu me donne mon prenom et tu dis que je te l'ai pas donner" → "D'accord
  // !"; "quoi d'autre" → "D'accord !"). The prompt already instructs the
  // model never to reply with ONLY marker lines (actions.ts) — that
  // instruction alone isn't reliably followed by a small/free-tier model.
  // Only mode 3 (intent.action === null) can ever be empty like this —
  // add_media/recommend always assemble their own content below regardless
  // of `cleaned`, so this retry never touches those.
  let finalCleaned = cleaned;
  // Same retry also covers a leaked "VÉRIFICATION RÉELLE"/"RECHERCHE
  // RÉELLE" block (confirmed live, TWICE, even after strengthening the
  // prompt wording alone — a small/free-tier model can still just copy the
  // block verbatim instead of paraphrasing it) — the prompt-only instruction
  // isn't reliably followed any more than the "no marker-only replies" rule
  // above, so it gets the exact same code-level retry-then-sanitize
  // treatment instead of staying a prompt-only hope.
  const leaked = intent.action === null && containsLeakedInternalBlock(cleaned);
  // Mirror-image of the leak/degenerate checks above: the user asks "do you
  // remember my name?" and the reply denies it even though a real "Prénom :
  // X" fact was already in the facts injected into THIS same request
  // (confirmed live — the model had used that exact name earlier in the
  // same conversation, then denied knowing it two messages later). Only
  // computed when actually needed (mode 3, and only once we already know
  // cleaned isn't degenerate/leaked) since it re-reads the facts store.
  const knownNameFact = intent.action === null && !isDegenerateReply(cleaned) && !leaked
    ? getFacts(user.id).find((f) => /pr[ée]nom/i.test(f.fact))?.fact
    : undefined;
  const falseNameDenial = intent.action === null && isFalseNameDenial(message, cleaned, knownNameFact);
  if (intent.action === null && (isDegenerateReply(cleaned) || leaked || falseNameDenial)) {
    try {
      const retrySystem = leaked
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a recopié TEL QUEL le bloc technique interne (le texte commençant par "VÉRIFICATION RÉELLE" ou "RECHERCHE RÉELLE", avec ses flèches →, ses crochets [film, tmdb:...] et ses OUI/NON en majuscules) — c'est une erreur, cette note est réservée à un usage interne, jamais à afficher telle quelle. Réponds cette fois en une ou deux phrases naturelles et chaleureuses qui donnent EXACTEMENT la même information (les faits doivent rester identiques, ne change ni n'invente rien), sans jamais réutiliser le libellé "VÉRIFICATION RÉELLE"/"RECHERCHE RÉELLE" ni sa structure. Exemple : au lieu de "VÉRIFICATION RÉELLE pour « Dune » → identifié comme Dune (2021) [film, tmdb:438631] : OUI, déjà dans la bibliothèque.", réponds quelque chose comme "Ouais, tu l'as déjà ! Dune (2021) est bien dans ta bibliothèque."`
        : falseNameDenial
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a PRÉTENDU ne pas connaître le prénom de l'utilisateur ("je ne sais pas", "dis-le-moi"...) alors qu'il figure bien dans les faits retenus fournis plus haut dans ce prompt (${knownNameFact}). C'est un mensonge sur ta propre mémoire — exactement le genre d'erreur que tu dois éviter absolument. Réponds cette fois en confirmant directement et naturellement que tu t'en souviens, en utilisant ce prénom exact.`
        : `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message ne contenait AUCUNE phrase réelle${facts.length ? ` (seulement ${facts.length > 1 ? "des lignes" : "une ligne"} interne${facts.length > 1 ? "s" : ""} de mémorisation, ex. ${facts.map((f) => `« ${f} »`).join(", ")})` : ""} — c'est une erreur, jamais une réponse acceptable. Réponds cette fois avec une vraie phrase, en français, qui répond concrètement à ce que l'utilisateur vient de dire — garde ta personnalité habituelle. Tu peux toujours ajouter une ligne \`[[FAIT: ...]]\` APRÈS cette phrase si pertinent, mais ta réponse ne peut plus être vide de texte réel.`;
      const retryRes = await callAi(config, retrySystem, session.messages);
      const retryIntent = parseIntent(retryRes.text);
      // Only trust the retry if it stayed in mode 3 — a retry that suddenly
      // emits add_media/recommend JSON would be a mode switch mid-repair,
      // not the "same reply, just with actual text" repair this is for.
      if (retryIntent.action === null) {
        const { facts: retryFacts, cleaned: retryAfterFacts } = extractFacts(retryIntent.rawText);
        for (const fact of retryFacts) rememberFact(user.id, fact);
        const { watched: retryWatched, cleaned: retryCleaned } = extractWatched(retryAfterFacts);
        if (retryWatched.length) {
          for (const w of retryWatched) {
            try {
              const resolved = await resolveAiItem({ title: w.title, type: w.type });
              if (!resolved) continue;
              if (resolved.type === "movie") setWatchedMovies(user.id, [resolved.tmdbId], true, resolved.title);
              else recordWatched(user.id, { tmdbId: resolved.tmdbId, type: "series", title: resolved.title, at: Date.now() });
            } catch {
              // best-effort, see comment above
            }
          }
        }
        if (!isDegenerateReply(retryCleaned)) finalCleaned = retryCleaned;
      }
    } catch {
      // Best-effort, bounded to exactly one attempt — if the retry itself
      // fails (network/quota/timeout) or also comes back empty, fall
      // through to the informative fallback string below rather than a
      // second retry or a throw that would break the whole request.
    }
  }
  // Last-resort safety net: even the corrective retry above can still leak
  // the raw block (or the retry branch above wasn't reached because
  // `cleaned` leaked but the outer `if` somehow didn't retry — kept
  // unconditional so this is never bypassable) — strip the internal
  // label/structure so the literal "VÉRIFICATION RÉELLE"/"RECHERCHE
  // RÉELLE" text never reaches the user, even if the sentence that comes
  // out is rougher than a real paraphrase would have been.
  if (containsLeakedInternalBlock(finalCleaned)) finalCleaned = sanitizeLeakedBlock(finalCleaned);
  // Last-resort fallback (retry above also came back empty, or wasn't
  // attempted because it isn't mode 3): admits the difficulty plainly
  // instead of a cheerful non-sequitur, without asking the user to
  // reformulate (explicit prompt rule elsewhere in buildSystemPrompt — kept
  // consistent here too).
  const FALLBACK_TEXT = "Désolé, j'ai un vrai blocage pour te répondre correctement là tout de suite — donne-moi un instant, ça devrait aller au prochain message.";
  const assistant: AiChatMessage = { role: "assistant", content: finalCleaned || FALLBACK_TEXT };

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
    let franchise: FranchiseContext | undefined;
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
        if (collection) {
          const tmdbIds = new Set(collection.parts.map((p) => p.tmdbId));
          // Franchise continuation (vague 2, spec's Scary Movie walkthrough):
          // the next installment the user hasn't seen/owned yet, following
          // the reference in the collection's own release order — never
          // just "any entry in this saga". Parts are already sorted by
          // releaseDate ascending (getCollection).
          const watchStatus = getWatchStatus(user.id);
          const watchedMovies = new Set(watchStatus?.movies ?? []);
          const refIndex = collection.parts.findIndex((p) => p.tmdbId === pageContext.tmdbId);
          const nextTmdbId = refIndex >= 0
            ? collection.parts.slice(refIndex + 1).find((p) => !watchedMovies.has(p.tmdbId) && !getMovieByTmdbId(p.tmdbId))?.tmdbId
            : undefined;
          franchise = { tmdbIds, nextTmdbId };
        }
      }
    }

    // TasteCompatibility (§2.H) — independent of pageContext: it's built
    // purely from the user's own past 👍/👎 log + whatever those titles'
    // Mood Engine profiles already are (cache-only lookup, no new LLM
    // call), so it applies whenever there IS a candidate mood profile to
    // compare against — which today means whenever the mood term above
    // also ran, since that's what populates candidate profiles.
    const tasteVector = buildTasteVector(user.id);

    // Content fatigue (vague 2, spec "recentExposure") — averaged mood of
    // the user's own last few watched titles, cache-only (never triggers a
    // new analysis just for this). Requires at least 3 recently watched
    // titles with an already-cached profile — a weaker signal than that
    // isn't worth acting on (spec §16: a single observation is weak).
    const recentWatched = (getWatchStatus(user.id)?.recent ?? []).slice(0, 8);
    const recentProfiles = recentWatched
      .map((r) => getCachedMoodProfile(r.type, r.tmdbId)?.categories)
      .filter((p): p is AiMoodCategories => !!p);
    const fatigue: FatigueContext | undefined = recentProfiles.length >= 3
      ? { profile: averageProfiles(recentProfiles), strength: Math.min(1, recentProfiles.length / 6) }
      : undefined;

    const recommendations = scoreCandidates(user.id, allItems, reasons, 6, mood, tasteVector, franchise, fatigue)
      .map((r) => ({ ...r, reason: reasons.get(`${r.type}:${r.tmdbId}`) }));
    assistant.recommendations = recommendations;
    itemCount = recommendations.length;
    // Bug fix (confirmed live): unlike add_media just above, this branch
    // never reassigned `assistant.content` — a "recommend" reply is pure
    // JSON by prompt design (buildSystemPrompt), so `cleaned` is virtually
    // always empty, which meant EVERY recommendation reply fell through to
    // the generic FALLBACK_TEXT ("j'ai un vrai blocage...") set way above,
    // shown right on top of the recommendation cards it had just built
    // successfully — a false "something's wrong" message on the single
    // most common successful path in the whole feature.
    assistant.content = [cleaned, recommendations.length
      ? "Voici ce qui devrait bien coller :"
      : "Je n'ai rien trouvé qui corresponde vraiment cette fois — essaie de préciser un peu ta demande."].filter(Boolean).join("\n\n");
    console.log(`[ai] action=recommend candidates=${allItems.length} (llm=${pairs.length}) shown=${recommendations.length} mood=${!!mood} user=${user.username}`);
  }
  recordAiCall({
    username: user.username, kind: intent.action ?? "chat", provider: providerName,
    success: true, durationMs: latency, itemCount, message,
  });

  pushAiMessage(user.id, assistant);
  return NextResponse.json({ message: assistant, provider: providerName });
}