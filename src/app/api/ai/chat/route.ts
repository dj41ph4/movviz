import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiConfig, pushAiMessage, loadAiSession, setActiveSubject } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { parseIntent, extractFacts, extractWatched, extractRatings, extractSelfIntroName, extractNameFromDirectAnswer, detectLibraryFalseNegativeCorrection, extractMissingFromEntity, extractFilmographyQuestion, extractLibraryPresenceQuestion, extractWatchStatusQuestion, extractCastCrewQuestion, extractSeriesStatusQuestion, extractBareTitleMention, isSeriesStatusAboutCurrentPage, isDegenerateReply, isMechanicalBulletReply, sanitizeMechanicalBulletReply, containsLeakedInternalBlock, sanitizeLeakedBlock, containsLeakedActionJson, sanitizeLeakedActionJson, isFalseNameDenial, isFalseInternetDenial, isUnresolvedCheckPromise, claimsRatingWithoutMarker, promisesListWithNothing, isRecommendationContinuation, extractExplicitTasteRating } from "@/lib/ai/intentParser";
import { addMedia, recommendMedia, buildUserContext, buildSystemPrompt, mapWithConcurrency, getSimilarCandidates, resolveAiItem, isEpisodeListRequest, buildEpisodeListContext, buildMissingFromFranchiseContext, MAX_FRANCHISE_HITS, buildFilmographyContext, MAX_FILMOGRAPHY_HITS, buildLibraryPresenceContext, buildWatchStatusContext, buildCastCrewContext, buildTitleStatusContext, buildTitleMentionContext, pickProactiveRatingCandidate, type FranchiseSearchHit, type WatchStatusResult, type TitleRef } from "@/lib/ai/actions";
import { buildMemoryContext } from "@/lib/ai/memory";
import { buildFeedbackContext, buildFactsContext, buildContextInsightsSection, buildCorrectionEscalationContext, recordCorrection, rememberFact, getFacts, hasKnownName, buildRatingsContext, setRating, getRating, getAllRatings, getLastProactiveRatingAskAt, markProactiveRatingAsked } from "@/lib/ai/tasteProfile";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";
import { scoreCandidates, isSeriesFullyWatched, type MoodContext, type FranchiseContext, type FatigueContext } from "@/lib/ai/recommendationScore";
import { getOrAnalyzeMoodProfile, getCachedMoodProfile } from "@/lib/ai/titleAnalysis";
import { buildTasteVector, averageProfiles } from "@/lib/ai/contrastiveProfile";
import { getMovie, getSeries, getDetail, getCollection, searchMulti, searchPerson, getPerson } from "@/lib/metadata/tmdb";
import { resolveTitleAgainstTmdb } from "@/lib/metadata/resolveTitle";
import { buildUsageProfile, formatUsageProfile } from "@/lib/ai/profile";
import { getWatchStatus, setWatchedMovies, recordWatched } from "@/lib/plex/watchStore";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getOrFetchScene } from "@/lib/ai/sceneCache";
import { recordAiCall } from "@/lib/ai/debugLog";
import type { AiActionOutcome, AiChatMessage, AiAddItem, AiMoodCategories } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

// Proactive rating nudge tuning — see the call site's doc for the full
// reasoning. 6h cooldown + 30% chance even when eligible keeps this rare
// enough to never feel like an interrogation (spec: "ne jamais bombarder").
const PROACTIVE_RATING_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const PROACTIVE_RATING_CHANCE = 0.3;

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
  const previousAssistantText = previousAssistant?.role === "assistant" ? previousAssistant.content : undefined;
  // Acknowledge/imperative turns such as « ok », « vas-y » and « donne » are
  // interpreted from the immediately preceding offer, before any TMDb title
  // detection can mistake their text for a work name.
  const recommendationContinuation = isRecommendationContinuation(previousAssistantText, message);
  const introName = extractSelfIntroName(message)
    ?? extractNameFromDirectAnswer(previousAssistantText, message);
  if (introName) rememberFact(user.id, introName);

  // Explicit ratings must not depend on a small model deciding to output an
  // invisible [[NOTE: ...]] marker.  A whole-franchise statement remains a
  // durable taste fact (rather than incorrectly rating the last single film
  // in the conversation); a named individual work is stored as explicit.
  const explicitTasteRating = extractExplicitTasteRating(message);
  if (explicitTasteRating) {
    if (explicitTasteRating.isGlobal) {
      rememberFact(user.id, `Préférence forte : ${explicitTasteRating.subject} dans son ensemble mérite ${explicitTasteRating.stars}/5 à l'utilisateur.`);
    } else {
      try {
        const resolved = await resolveAiItem({ title: explicitTasteRating.subject });
        if (resolved) {
          setRating(user.id, {
            tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title,
            rating: explicitTasteRating.stars, source: "explicit", confidence: 1,
            opinion: "note explicite donnée en conversation",
          });
          triggerIncrementalContextIfDue(user.id).catch(() => {});
        } else {
          // Still valuable for taste even when TMDb cannot resolve a typo or
          // a franchise wording such as « South Parl ».
          rememberFact(user.id, `Préférence forte : ${explicitTasteRating.subject} mérite ${explicitTasteRating.stars}/5 à l'utilisateur.`);
        }
      } catch {
        rememberFact(user.id, `Préférence forte : ${explicitTasteRating.subject} mérite ${explicitTasteRating.stars}/5 à l'utilisateur.`);
      }
    }
  }

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
  let system = buildSystemPrompt(userContext, memoryContext, usageContext, feedbackContext, factsContext, isFirstInteraction, needsName, contextInsightsContext, correctionEscalationContext, config.webSearchEnabled);
  system += buildRatingsContext(user.id);
  if (recommendationContinuation) {
    system += "\n\nCONTINUITÉ DE RECOMMANDATION — la réponse très courte de l'utilisateur confirme ta proposition précédente. Fournis MAINTENANT une vraie sélection en MODE 2 : JSON recommend valide, 4 à 8 titres, sans texte autour. Ne traite jamais son mot court comme le titre d'une œuvre et ne redemande pas s'il veut des recommandations.";
  }
  if (explicitTasteRating) {
    system += `\n\nNOTE EXPLICITE DÉJÀ ENREGISTRÉE — l'utilisateur vient d'attribuer ${explicitTasteRating.stars}/5 à ${explicitTasteRating.isGlobal ? "l'ensemble de " : "« "}${explicitTasteRating.subject}${explicitTasteRating.isGlobal ? "" : " »"}. Réagis simplement et naturellement ; ne lui redemande ni confirmation ni une autre note.`;
  }

  // Proactive rating nudge (demande explicite user) — occasional, never
  // systematic: gated by BOTH a cooldown (never twice within the window,
  // regardless of how many messages happen) AND a random chance even once
  // eligible, so it doesn't fire on every eligible message and start
  // feeling mechanical. The model is only ever given the OPPORTUNITY — it
  // decides whether the moment actually fits (mode 3, and only if it flows
  // naturally), same restraint as every other optional personality beat in
  // buildSystemPrompt. If the user actually answers with a star count, the
  // EXISTING [[NOTE: ...]] marker mechanism (extractRatings) picks it up
  // like any other conversational rating — no separate handling needed.
  if (Date.now() - getLastProactiveRatingAskAt(user.id) > PROACTIVE_RATING_COOLDOWN_MS && Math.random() < PROACTIVE_RATING_CHANCE) {
    const candidate = pickProactiveRatingCandidate(user.id);
    if (candidate) {
      system += `\n\nOCCASION (facultative, jamais obligatoire) — « ${candidate.title} » (${candidate.type === "movie" ? "film" : "série"}) a été entièrement vu mais jamais noté. UNIQUEMENT SI TU RÉPONDS EN MODE 3 (texte normal) ET que ça s'intègre naturellement dans ce que dit l'utilisateur (jamais un non-sequitur hors sujet, jamais une question sèche en dehors de tout contexte), tu PEUX en profiter pour demander en une phrase courte et chaleureuse la note qu'il lui donnerait (ex. "Au fait, tu lui mettrais combien à « ${candidate.title} » ? ⭐"). Si le moment ne s'y prête vraiment pas, ignore complètement cette occasion — ne force jamais la question.`;
      markProactiveRatingAsked(user.id);
    }
  }

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

  // "Donne-moi la filmographie de X" — confirmed live: with no real data
  // path for this exact question shape, the model repeated the identical
  // canned refusal verbatim across five retries in the same conversation,
  // even after being told (falsely) "tu as accès à internet" — it had
  // nothing to say differently because nothing ever gave it real data to
  // work with. searchMulti (used by the "manque" block above) can't help
  // here: it filters OUT person results entirely, so a bare name like
  // "Brad Pitt" matched nothing. searchPerson keeps exactly those results.
  const filmographyQuery = extractFilmographyQuestion(message);
  if (filmographyQuery) {
    try {
      const person = await searchPerson(filmographyQuery);
      if (person) {
        const full = await getPerson(person.id);
        if (full) {
          const hits: FranchiseSearchHit[] = full.credits.slice(0, MAX_FILMOGRAPHY_HITS).map((c) => ({
            title: c.title,
            year: c.year ?? undefined,
            type: c.type,
            tmdbId: c.tmdbId,
            inLibrary: c.type === "movie" ? !!getMovieByTmdbId(c.tmdbId) : !!getSeriesByTmdbId(c.tmdbId),
          }));
          if (hits.length) system += buildFilmographyContext(filmographyQuery, full.name, hits, full.credits.length);
        }
      }
    } catch {
      // Best-effort, same safety net as the franchise-search block above.
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
      if (resolved) setActiveSubject(user.id, { tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title });
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
      if (resolved) setActiveSubject(user.id, { tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title });
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

  // Item 5 (mention casuelle, sans question) — voir buildTitleMentionContext.
  // Gardé APRÈS les 4 détecteurs "question" ci-dessus et les recherches
  // franchise/filmographie plus haut, pour ne jamais faire un second appel
  // TMDb sur un message qui a déjà déclenché un des blocs plus spécifiques.
  const bareTitleCandidate = (!recommendationContinuation && !explicitTasteRating && !watchStatusTitle && !presenceTitle && !castCrewTitle && !statusTitle && !statusIsCurrentPage && !missingFromEntity && !filmographyQuery)
    ? extractBareTitleMention(message)
    : null;
  if (bareTitleCandidate) {
    try {
      const resolved = await resolveTitleAgainstTmdb({ title: bareTitleCandidate });
      let watchResult: WatchStatusResult | null = null;
      let rating: { rating: number; source: "explicit" | "inferred" } | null = null;
      if (resolved) {
        const status = getWatchStatus(user.id);
        if (resolved.type === "movie") {
          watchResult = status?.movies.includes(resolved.tmdbId) ? "watched" : "not_watched";
        } else {
          const episodeKeys = new Set((status?.episodes ?? []).filter((e) => e.tmdbId === resolved.tmdbId).map((e) => `${e.season}.${e.episode}`));
          watchResult = episodeKeys.size === 0 ? "not_watched" : isSeriesFullyWatched(resolved.tmdbId, episodeKeys) ? "watched" : "partially_watched";
        }
        const existingRating = getRating(user.id, resolved.tmdbId, resolved.type);
        if (existingRating) rating = { rating: existingRating.rating, source: existingRating.source };
      }
      system += buildTitleMentionContext(bareTitleCandidate, resolved, watchResult, rating);
      if (resolved) setActiveSubject(user.id, { tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title });
    } catch {
      // Best-effort, see comment above.
    }
  }

  // SUJET ACTIF (audit : sans ça, hors page de titre, le modèle devait
  // deviner de quoi on parle en relisant jusqu'à 40 messages d'historique —
  // exactement le point de rupture des scénarios "Solo Leveling → j'adore →
  // le top c'est contre Beru", où le 3e message repartait en recherche TMDb).
  // Suivi côté code à partir des titres RÉELLEMENT résolus, jamais deviné.
  // Expiré au bout d'un moment : un sujet vieux de plusieurs heures n'est
  // plus "actif", et le forcer ferait plus de mal que de bien.
  const ACTIVE_SUBJECT_TTL_MS = 45 * 60 * 1000;
  const activeSubject = session.activeSubject;
  if (activeSubject && !pageContext && Date.now() - activeSubject.at < ACTIVE_SUBJECT_TTL_MS) {
    system += `\n\nSUJET ACTIF DE LA CONVERSATION — vous parlez actuellement de ${activeSubject.type === "movie" ? "le film" : "la série"} « ${activeSubject.title} ». Toute réaction courte ("j'adore", "c'était nul", "le meilleur c'est..."), toute référence implicite ("celui-là", "le deuxième") et tout nom de personnage/scène/acteur évoqué SANS préciser d'où il vient se rapportent À CE TITRE par défaut — jamais à un nouveau titre à rechercher. Ne pars chercher autre chose QUE si l'utilisateur nomme explicitement une autre œuvre.`;
  }

  if (pageContext) {
    setActiveSubject(user.id, { tmdbId: pageContext.tmdbId, type: pageContext.type, title: pageContext.title });
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
    return NextResponse.json({ error: "ai_call_failed", detail: (err.message ?? null)?.slice(0, 200) ?? null }, { status: 502 });
  }
  const latency = Date.now() - t0;
  const usedModel = (config.providers as Record<string, { model?: string }>)[providerName]?.model ?? "?";
  console.log(`[ai] chat ok user=${user.username} provider=${providerName} model=${usedModel} latency=${latency}ms`);

  let intent = parseIntent(text);
  // The model occasionally keeps chatting after an explicit « yes/give it
  // to me » even though this branch has already established that a selection
  // is required.  One bounded retry turns that unfulfilled promise into
  // cards; it can never trigger a library add because the required action is
  // recommend only.
  if (recommendationContinuation && intent.action !== "recommend") {
    try {
      const retrySystem = `${system}\n\nCORRECTION IMMÉDIATE : ta réponse précédente a ignoré une confirmation explicite de recommandation. Réponds maintenant UNIQUEMENT avec le JSON {"action":"recommend","items":[...]} demandé, contenant 4 à 8 titres réellement recommandés. Ne parle pas du mot court de l'utilisateur comme s'il s'agissait d'un titre et n'ajoute aucun média.`;
      const retryRes = await callAi(config, retrySystem, session.messages);
      const retryIntent = parseIntent(retryRes.text);
      if (retryIntent.action === "recommend") intent = retryIntent;
    } catch {
      // Best-effort: the normal response remains available if the provider
      // fails during this single corrective call.
    }
  }
  // Confirmed live: a bare title mention with no action verb ("Hurlevent",
  // "the nice guys") sometimes gets read by the model as an implicit
  // add_media request — the prompt already says mode 1/2 requires an
  // EXPLICIT add request, but a small model doesn't reliably respect that
  // for this ambiguous shape. Left alone, this silently calls addMedia and
  // the user only ever sees a bare outcome line ("Déjà dans la
  // bibliothèque — X") with ZERO reaction/personality — exactly the
  // "cold, robotic" complaint this whole item-5 mechanism exists to fix,
  // and worse, a genuinely NEW title could get silently added without the
  // user ever having asked for that. Retried the same bounded way as the
  // promise-list fix below: force mode 3 for THIS message only, so the
  // VÉRIFICATION RÉELLE data already injected above actually gets used.
  if (bareTitleCandidate && intent.action === "add_media") {
    try {
      const retrySystem = `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a traité une simple mention de titre ("${bareTitleCandidate}") comme une DEMANDE D'AJOUT explicite (JSON add_media) — c'est une erreur, l'utilisateur n'a employé aucun verbe d'action (ajoute, mets, télécharge, prends...), il a juste mentionné le titre. Réponds cette fois en MODE 3 UNIQUEMENT (texte normal, jamais de JSON), en réagissant naturellement à ce titre avec ta personnalité habituelle et en utilisant la section "VÉRIFICATION RÉELLE — titre mentionné" fournie plus haut dans ce prompt — ne l'ajoute PAS toi-même à la bibliothèque sans demande explicite.`;
      const retryRes = await callAi(config, retrySystem, session.messages);
      const retryIntent = parseIntent(retryRes.text);
      if (retryIntent.action === null) intent = retryIntent;
    } catch {
      // Best-effort, single bounded retry — falls through to the original
      // add_media outcome if this also fails, same as every other retry
      // in this file.
    }
  }
  // Confirmed live: a genuine recommend-shaped request ("surprends-moi,
  // sors moi de ma zone de confort") got a mode-3 prose reply that PROMISED
  // a list ("Voici ce qui devrait te surprendre...") but never actually
  // switched to the JSON format behind it — no items, no cards, just an
  // unfulfilled promise. Retried BEFORE any of the mode-3-specific
  // processing below (extractFacts/extractWatched all read from `intent`),
  // replacing it wholesale when the retry does better, so the existing
  // add_media/recommend branches further down handle a genuine mode switch
  // exactly like a normal first-try success — unlike the retries below
  // (leaked block / false name denial / degenerate reply), which
  // deliberately stay mode-3-only repairs.
  if (intent.action === null && promisesListWithNothing(intent.rawText)) {
    try {
      const retrySystem = `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message annonçait une liste ("${intent.rawText.trim()}") mais ne contenait ensuite AUCUN élément réel — tu as répondu en texte libre au lieu du format JSON attendu pour une vraie recommandation ou un vrai ajout. Réponds cette fois avec le VRAI format JSON décrit plus haut dans ce prompt (mode 1 ou 2), avec de vrais titres dedans — jamais une simple promesse de liste sans contenu derrière.`;
      const retryRes = await callAi(config, retrySystem, session.messages);
      const retryIntent = parseIntent(retryRes.text);
      if (retryIntent.action !== null || !promisesListWithNothing(retryIntent.rawText)) {
        intent = retryIntent;
      }
    } catch {
      // Best-effort, single bounded retry — falls through to the original
      // (unfulfilled-promise) reply if this also fails.
    }
  }
  const { facts, cleaned: afterFacts } = extractFacts(intent.rawText);
  for (const fact of facts) rememberFact(user.id, fact);
  const { watched, cleaned: afterWatched } = extractWatched(afterFacts);
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
  const { ratings, cleaned } = extractRatings(afterWatched);
  // Titres dont la note a RÉELLEMENT été enregistrée (résolus + écrits) —
  // sert à construire une confirmation honnête si le modèle n'a produit
  // aucune phrase autour de ses marqueurs (voir plus bas).
  const appliedRatings: { title: string; stars: number }[] = [];
  if (ratings.length) {
    // Always stored as source "inferred" (setRating never lets this
    // override an existing explicit rating — see tasteProfile.ts) — same
    // best-effort resolution as the watched-titles block above.
    for (const r of ratings) {
      try {
        const resolved = await resolveAiItem({ title: r.title, type: r.type });
        if (!resolved) continue;
        setRating(user.id, {
          tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title,
          rating: r.stars, source: "inferred", confidence: 0.6, opinion: r.opinion,
        });
        appliedRatings.push({ title: resolved.title, stars: r.stars });
        // Same fire-and-forget pattern as every other real-activity
        // producer (watch/toggle, ai/watched, ai/feedback, netflix import,
        // and now the ratings widget itself) — a rating is exactly the
        // kind of signal the consolidated context should pick up on its
        // own, without waiting for a manual "Régénérer le contexte".
        triggerIncrementalContextIfDue(user.id).catch(() => {});
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
  // Confirmed live, TWICE: with "Recherche web" ON in Réglages, the model
  // still flatly denied any internet access at all when asked directly —
  // false while the toggle is on (a real search does happen for the
  // memorable-scene feature). The prompt already carries the real toggle
  // state (buildSystemPrompt's webAccess block) but that alone wasn't
  // reliably followed, same as every other "prompt-only fact about the
  // model's own state" bug fixed this session.
  const falseInternetDenial = intent.action === null && !isDegenerateReply(cleaned) && !leaked && !falseNameDenial
    && isFalseInternetDenial(message, cleaned, config.webSearchEnabled);
  // Confirmed live: "je vais vérifier ça tout de suite !" as the entire
  // reply, then nothing — Movviz has no async follow-up, so a promise like
  // this is either resolved IN THIS SAME reply or it's a dead end the user
  // has to notice and re-prompt around. `hasRealVerification` tells the
  // retry whether real data was actually injected this turn (one of the 5
  // VÉRIFICATION RÉELLE detectors above matched) — if so, the model has
  // everything it needs to answer directly instead of promising to check;
  // if not, it should honestly say it can't verify rather than promise.
  const hasRealVerification = !!(watchStatusTitle || presenceTitle || castCrewTitle || statusTitle || statusIsCurrentPage || bareTitleCandidate);
  const unresolvedPromise = intent.action === null && !isDegenerateReply(cleaned) && !leaked && !falseNameDenial && !falseInternetDenial
    && isUnresolvedCheckPromise(cleaned);
  // Confirmed live: for a bare title mention, the reply came back as
  // "• Déjà dans la bibliothèque — The Nice Guys (2016)" — mode 3 (no JSON,
  // so the add_media guard above never sees it), and not a literal copy of
  // the "VÉRIFICATION RÉELLE" label either (so `leaked` misses it too), but
  // a mechanical imitation of the UNRELATED summarizeAdd() bullet format
  // this same conversation had used earlier for actual adds — the model
  // pattern-matched the wrong internal format instead of writing a real
  // reaction. Same underlying problem as `leaked` (internal formatting
  // shown raw), different shape, so it gets the same retry treatment.
  const mechanicalBullet = intent.action === null && !isDegenerateReply(cleaned) && !leaked && !falseNameDenial && !falseInternetDenial && !unresolvedPromise
    && isMechanicalBulletReply(cleaned);
  // Confirmé en direct : "mets 5 étoiles à tous" → belle liste "Titre : 5/5"
  // + "voici les notes mises à jour", et ZÉRO marqueur [[NOTE: ...]] émis,
  // donc rien d'enregistré. `ratings` vient de extractRatings plus haut sur
  // CETTE réponse : s'il est vide alors que la réponse annonce des notes,
  // c'est un mensonge sur action — même traitement que les autres.
  const fakeRatingClaim = intent.action === null && !isDegenerateReply(cleaned) && !leaked && !falseNameDenial && !falseInternetDenial && !unresolvedPromise && !mechanicalBullet
    && claimsRatingWithoutMarker(cleaned, ratings.length);
  if (intent.action === null && (isDegenerateReply(cleaned) || leaked || falseNameDenial || falseInternetDenial || unresolvedPromise || mechanicalBullet || fakeRatingClaim)) {
    try {
      const retrySystem = leaked
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a recopié TEL QUEL le bloc technique interne (le texte commençant par "VÉRIFICATION RÉELLE" ou "RECHERCHE RÉELLE", avec ses flèches →, ses crochets [film, tmdb:...] et ses OUI/NON en majuscules) — c'est une erreur, cette note est réservée à un usage interne, jamais à afficher telle quelle. Réponds cette fois en une ou deux phrases naturelles et chaleureuses qui donnent EXACTEMENT la même information (les faits doivent rester identiques, ne change ni n'invente rien), sans jamais réutiliser le libellé "VÉRIFICATION RÉELLE"/"RECHERCHE RÉELLE" ni sa structure. Exemple : au lieu de "VÉRIFICATION RÉELLE pour « Dune » → identifié comme Dune (2021) [film, tmdb:438631] : OUI, déjà dans la bibliothèque.", réponds quelque chose comme "Ouais, tu l'as déjà ! Dune (2021) est bien dans ta bibliothèque."`
        : mechanicalBullet
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message ("${cleaned.trim().slice(0, 200)}") n'était qu'une ligne technique en style base de données (puce "•", format "Champ — Valeur"), pas une vraie phrase — ce format est réservé aux résultats d'ajout, jamais à une réaction sur un titre mentionné. Réponds cette fois avec une vraie phrase naturelle et chaleureuse (garde ta personnalité, emojis avec modération), en te basant sur les mêmes faits réels donnés plus haut dans ce prompt — jamais sous forme de puce ou de liste technique.`
        : fakeRatingClaim
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message annonçait des notes ("c'est noté", "voici les notes mises à jour", ou une liste "Titre : 5/5") SANS émettre la moindre ligne \`[[NOTE: ...]]\` — donc RIEN n'a été enregistré, et tu as menti à l'utilisateur sur une action que tu n'as pas faite. Recommence : pour CHAQUE titre concerné (jusqu'à 10), écris une ligne dédiée strictement au format \`[[NOTE: Titre exact|movie|5]]\` ou \`[[NOTE: Titre exact|series|5]]\` selon qu'il s'agit d'un film ou d'une série, en reprenant les titres EXACTS dont vous venez de parler et la note demandée par l'utilisateur. Ces lignes viennent APRÈS une phrase de réponse normale et ne sont jamais montrées à l'utilisateur — c'est ce qui enregistre réellement les notes. Sans elles, ta réponse est un mensonge.`
        : falseNameDenial
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a PRÉTENDU ne pas connaître le prénom de l'utilisateur ("je ne sais pas", "dis-le-moi"...) alors qu'il figure bien dans les faits retenus fournis plus haut dans ce prompt (${knownNameFact}). C'est un mensonge sur ta propre mémoire — exactement le genre d'erreur que tu dois éviter absolument. Réponds cette fois en confirmant directement et naturellement que tu t'en souviens, en utilisant ce prénom exact.`
        : falseInternetDenial
        ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message a nié CATÉGORIQUEMENT tout accès à internet ("je n'ai pas accès", "Movviz ne me donne pas cette capacité"...) — c'est FAUX en ce moment précis : la recherche web EST activée sur ce compte (Réglages → section IA), une vraie recherche a bien lieu en coulisses pour certaines fonctionnalités précises (comme retrouver une scène mémorable), même si toi-même tu ne la déclenches jamais à la demande en pleine conversation. Réponds cette fois en expliquant cette nuance précise et honnête — ni un déni catégorique, ni une prétention d'avoir un accès web général à la demande.`
        : unresolvedPromise
        ? (hasRealVerification
            ? `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message s'est contentée de PROMETTRE de vérifier quelque chose ("je vais vérifier", "laisse-moi regarder"...) alors qu'une vraie vérification (section "VÉRIFICATION RÉELLE" plus haut dans ce prompt) est DÉJÀ disponible dans ce même message — tu n'as aucune raison d'attendre, réponds directement et maintenant avec cette information réelle, dans ta personnalité habituelle (naturel, chaleureux, avec des emojis avec modération).`
            : `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message s'est contentée de PROMETTRE de vérifier quelque chose ("je vais vérifier"...) — c'est une erreur, Movviz n'a pas de mécanisme pour revenir vers l'utilisateur après coup, une promesse comme ça reste sans suite pour toujours. Réponds cette fois soit avec l'information si tu l'as réellement, soit en disant honnêtement que tu ne peux pas vérifier ça pour l'instant — jamais une promesse d'action que tu ne peux pas tenir dans ce même message.`)
        : `${system}\n\nATTENTION — CORRECTION IMMÉDIATE : ta réponse précédente à ce même message ne contenait AUCUNE phrase réelle${facts.length ? ` (seulement ${facts.length > 1 ? "des lignes" : "une ligne"} interne${facts.length > 1 ? "s" : ""} de mémorisation, ex. ${facts.map((f) => `« ${f} »`).join(", ")})` : ""} — c'est une erreur, jamais une réponse acceptable. Réponds cette fois avec une vraie phrase, en français, qui répond concrètement à ce que l'utilisateur vient de dire — garde ta personnalité habituelle. Tu peux toujours ajouter une ligne \`[[FAIT: ...]]\` APRÈS cette phrase si pertinent, mais ta réponse ne peut plus être vide de texte réel.`;
      const retryRes = await callAi(config, retrySystem, session.messages);
      const retryIntent = parseIntent(retryRes.text);
      // Only trust the retry if it stayed in mode 3 — a retry that suddenly
      // emits add_media/recommend JSON would be a mode switch mid-repair,
      // not the "same reply, just with actual text" repair this is for.
      if (retryIntent.action === null) {
        const { facts: retryFacts, cleaned: retryAfterFacts } = extractFacts(retryIntent.rawText);
        for (const fact of retryFacts) rememberFact(user.id, fact);
        const { watched: retryWatched, cleaned: retryAfterWatched } = extractWatched(retryAfterFacts);
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
        const { ratings: retryRatings, cleaned: retryCleaned } = extractRatings(retryAfterWatched);
        if (retryRatings.length) {
          for (const r of retryRatings) {
            try {
              const resolved = await resolveAiItem({ title: r.title, type: r.type });
              if (!resolved) continue;
              setRating(user.id, {
                tmdbId: resolved.tmdbId, type: resolved.type, title: resolved.title,
                rating: r.stars, source: "inferred", confidence: 0.6, opinion: r.opinion,
              });
              if (!appliedRatings.some((a) => a.title === resolved.title)) {
                appliedRatings.push({ title: resolved.title, stars: r.stars });
              }
              triggerIncrementalContextIfDue(user.id).catch(() => {});
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
  // Same belt-and-suspenders idea, for a raw `{"action":"add_media"...}`
  // JSON block ending up in what's shown to the user (reported live) —
  // mode 3 only, since a genuine add_media/recommend reply never reaches
  // `finalCleaned` with its JSON intact (parseIntent strips it before this
  // point). Only fires here as an unconditional last resort.
  if (containsLeakedActionJson(finalCleaned)) finalCleaned = sanitizeLeakedActionJson(finalCleaned);
  // Same idea, for the mechanical-bullet shape (see isMechanicalBulletReply
  // doc) — confirmed live that the bounded retry above doesn't reliably fix
  // this on its own, so this deterministic reformatting is the actual
  // guarantee, not just a nice-to-have on top of the retry.
  if (isMechanicalBulletReply(finalCleaned)) finalCleaned = sanitizeMechanicalBulletReply(finalCleaned);
  // Last-resort fallback (retry above also came back empty, or wasn't
  // attempted because it isn't mode 3): admits the difficulty plainly
  // instead of a cheerful non-sequitur, without asking the user to
  // reformulate (explicit prompt rule elsewhere in buildSystemPrompt — kept
  // consistent here too).
  // Confirmé en direct : sur une demande de notation ("mets 5 étoiles à X, Y
  // et Z"), le modèle répond parfois UNIQUEMENT avec ses marqueurs
  // `[[NOTE: ...]]` et aucune phrase autour. Les notes SONT alors bien
  // enregistrées, mais l'utilisateur voyait "j'ai un vrai blocage" — le
  // pire des deux mondes : une action réussie annoncée comme un échec.
  // Quand des notes ont réellement été posées, la confirmation est
  // construite ici, côté code, à partir de ce qui a VRAIMENT été écrit en
  // base (jamais de ce que le modèle prétend) — même discipline que
  // sanitizeMechanicalBulletReply.
  if (!finalCleaned && appliedRatings.length) {
    const list = appliedRatings.map((r) => `${r.title} (${r.stars}/5)`).join(", ");
    finalCleaned = appliedRatings.length === 1
      ? `C'est noté ⭐ ${list}.`
      : `C'est noté ⭐ ${list} — ${appliedRatings.length} titres mis à jour.`;
  }
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
