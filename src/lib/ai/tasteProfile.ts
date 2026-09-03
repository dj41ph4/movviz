import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import type { AiContextInsight, AiContextProfile, AiCorrectionEntry, AiFactEntry, AiFeedbackEntry, AiProfileStore, AiUserProfile, TitleRating, RatingSource, RatingOrigin } from "./types";

/**
 * Foundation of the AI v2 taste engine (AI.MD §2.A/§2.G): a strictly
 * per-user, append-only log of 👍/👎 reactions to recommendation cards,
 * persisted to ai-user-profiles.json. This brick only captures and surfaces
 * the raw signal — turning it into weighted traits (contrastive learning,
 * confidence/evolution) is a later brick, deliberately not done here.
 *
 * Same storage pattern as ai-memory.json (readJsonCached/writeJsonCached,
 * bounded list, dedupe by tmdbId+type keeping the most recent vote) — a
 * user changing their mind on a title overwrites the old vote rather than
 * accumulating contradictory entries.
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-user-profiles.json");

const MAX_FEEDBACK_ENTRIES = 200;
// 100 faits — demande explicite ("il doit enregistrer plus de contexte,
// plus il en apprend plus il me connaît") : l'extraction conversationnelle
// continue (factExtractor.ts) alimente ce stock, qui doit couvrir des mois
// de conversations sans évincer les apprentissages importants.
const MAX_FACT_ENTRIES = 100;

function read(): AiProfileStore {
  const raw = readJsonCached<AiProfileStore | null>(FILE, null);
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function write(store: AiProfileStore): void {
  writeJsonCached(FILE, store);
}

function profileForUser(store: AiProfileStore, userId: string): AiUserProfile {
  const existing = store[userId];
  // facts is newer than feedback — old on-disk profiles may predate it.
  // corrections is newer still — a previous session already found and fixed
  // a real bug here once (the `context` field silently dropped because it
  // wasn't copied through) so every field added to AiUserProfile MUST be
  // copied through here explicitly, never assumed to "just work" via spread.
  return { feedback: existing?.feedback ?? [], facts: existing?.facts ?? [], context: existing?.context, corrections: existing?.corrections ?? [], ratings: existing?.ratings ?? [], lastProactiveRatingAskAt: existing?.lastProactiveRatingAskAt };
}

export function recordFeedback(userId: string, entry: AiFeedbackEntry): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const deduped = profile.feedback.filter((e) => !(e.tmdbId === entry.tmdbId && e.type === entry.type));
  deduped.push(entry);
  store[userId] = { ...profile, feedback: deduped.slice(-MAX_FEEDBACK_ENTRIES) };
  write(store);
  // Dual-write into the unified context ledger (ai-user-profiles.json stays
  // the authoritative store for THIS domain — dedup-by-title, the "×" undo
  // button, etc. — but every mutation here should also be a fact the ledger
  // can reason over alongside playback/search/view events for the same
  // user). sourceEventId keyed on tmdbId+type+vote makes a changed-mind vote
  // (like → dislike) land as its own row rather than silently overwriting —
  // the ledger is append-only, unlike the deduped JSON list above.
  recordUserContextEvent({
    userId,
    eventType: entry.liked ? "recommendation_liked" : "recommendation_disliked",
    source: "ai_feedback",
    sourceEventId: `feedback:${userId}:${entry.type}:${entry.tmdbId}:${entry.liked ? "like" : "dislike"}:${entry.at}`,
    tmdbId: entry.tmdbId,
    mediaType: entry.type,
    title: entry.title,
    textValue: entry.reason ?? null,
    occurredAt: entry.at,
  });
}

export function getFeedback(userId: string): AiFeedbackEntry[] {
  return profileForUser(read(), userId).feedback;
}

/** Retire un retour 👍/👎 du contexte (demande explicite — bouton "×" du
 *  panneau profil sur un titre apprécié/rejeté). Contrairement à
 *  recordFeedback (dédoublonnage automatique), c'est ici une suppression
 *  volontaire : l'utilisateur ne veut plus que ce titre influence ses
 *  recommandations (ex. un 👎 posé par erreur). Silencieux si l'entrée
 *  n'existe déjà plus (idempotent). */
export function removeFeedback(userId: string, tmdbId: number, type: "movie" | "series"): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const filtered = profile.feedback.filter((e) => !(e.tmdbId === tmdbId && e.type === type));
  if (filtered.length === profile.feedback.length) return;
  store[userId] = { ...profile, feedback: filtered };
  write(store);
}

// A first name is a single fixed value, not a growing list — if the user
// gives a new one, that REPLACES the old one (a correction, a name change,
// or the same person clarifying) rather than piling up two contradictory
// "Prénom : X" facts that would both get fed into the prompt at once.
const NAME_FACT_RE = /pr[ée]nom/i;

/** Stores a freeform fact the model extracted from conversation (see
 *  intentParser.extractFacts) — deduped case-insensitively so a repeated
 *  "I'm called Alex" doesn't pile up, bounded so the prompt this feeds back
 *  into never grows unbounded. */
export function rememberFact(userId: string, fact: string): void {
  const store = read();
  const profile = profileForUser(store, userId);
  let deduped = profile.facts.filter((f) => f.fact.toLowerCase() !== fact.toLowerCase());
  if (NAME_FACT_RE.test(fact)) deduped = deduped.filter((f) => !NAME_FACT_RE.test(f.fact));
  deduped.push({ fact, at: Date.now() });
  // Audit finding #6 (minor, confirmed): a plain trailing slice() could let
  // the name fact age out after 30 later facts, silently breaking the
  // "prénom fixe" guarantee (brique 14) for a long-term chatty user. The
  // name (if any survived the push above) is pinned separately from the
  // FIFO trim of everything else.
  const nameFact = deduped.find((f) => NAME_FACT_RE.test(f.fact));
  const rest = deduped.filter((f) => f !== nameFact).slice(-(nameFact ? MAX_FACT_ENTRIES - 1 : MAX_FACT_ENTRIES));
  store[userId] = { ...profile, facts: nameFact ? [...rest, nameFact] : rest };
  write(store);
}

export function getFacts(userId: string): AiFactEntry[] {
  return profileForUser(read(), userId).facts;
}


/** Latest explicit statement about one named preference wins over an older
 * explicit statement about the same subject. This is deliberately narrower
 * than generic rememberFact(): corrections must replace, not accumulate as
 * contradictory facts. */
export function rememberExplicitPreferenceFact(userId: string, subject: string, positive: boolean): void {
  const cleanSubject = subject.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!cleanSubject) return;
  const store = read();
  const profile = profileForUser(store, userId);
  const signature = cleanSubject.toLocaleLowerCase("fr");
  const prefixRe = /^Préférence explicite — (.+?) : /i;
  const filtered = profile.facts.filter((entry) => {
    const match = entry.fact.match(prefixRe);
    return !match || match[1].trim().toLocaleLowerCase("fr") !== signature;
  });
  filtered.push({
    fact: `Préférence explicite — ${cleanSubject} : ${positive ? "aime fortement ce titre" : "n'aime pas ce titre"}.`,
    at: Date.now(),
  });
  store[userId] = { ...profile, facts: filtered.slice(-MAX_FACT_ENTRIES) };
  write(store);
}

/** Réinitialise le contexte IA à zéro (bouton « Réinitialiser le contexte »
 *  du panneau profil — demande explicite : "revenir à 0"). Vide le contexte
 *  consolidé (insights) ET les faits retenus en conversation : tout ce que
 *  l'assistant avait appris sur l'utilisateur est oublié, il repart de rien.
 *  Les retours 👍/👎, notes et corrections sont des ACTIONS de l'utilisateur,
 *  pas du contexte appris : on les conserve (un reset ne doit pas effacer
 *  l'historique réel de ses votes). */
export function resetContextProfile(userId: string): void {
  const store = read();
  const profile = profileForUser(store, userId);
  store[userId] = { ...profile, context: undefined, facts: [] };
  write(store);
}

/** Whether the user's first name is already known — checked loosely (any
 *  stored fact mentioning "prénom", not just the exact "Prénom : X" format
 *  extractSelfIntroName writes) since an LLM-tagged fact could phrase it
 *  differently. Used to decide whether the prompt should nudge the model
 *  to actually ask for it, rather than leaving that to chance. */
export function hasKnownName(userId: string): boolean {
  return getFacts(userId).some((f) => /pr[ée]nom/i.test(f.fact));
}

const MAX_CONTEXT_INSIGHTS = 15;

export function getContextProfile(userId: string): AiContextProfile | null {
  return profileForUser(read(), userId).context ?? null;
}

/** Replaces the insight list wholesale (bootstrap) or merges new ones in
 *  (incremental, `merge: true`) — see contextBuilder.ts for which mode
 *  callers use. On merge, an incoming insight whose text matches an
 *  existing one (normalized) UPDATES it in place (fresh confidence/trend/
 *  evidenceCount, same spirit as the spec's "une préférence peut évoluer ou
 *  diminuer") instead of duplicating; a genuinely new one is appended.
 *  Bounded the same way as facts/feedback: oldest evicted first once the
 *  cap is hit. */
export function saveContextInsights(userId: string, newInsights: AiContextInsight[], merge: boolean): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const norm = (s: string) => s.trim().toLowerCase();
  let combined = merge ? [...(profile.context?.insights ?? [])] : [];
  for (const incoming of newInsights) {
    const idx = combined.findIndex((e) => norm(e.text) === norm(incoming.text));
    if (idx >= 0) combined[idx] = incoming;
    else combined.push(incoming);
  }
  combined = combined.slice(-MAX_CONTEXT_INSIGHTS);
  const context: AiContextProfile = { insights: combined, builtAt: Date.now() };
  store[userId] = { ...profile, context };
  write(store);
}

/** Compact context for the system prompt — the synthesized "what Movviz AI
 *  has figured out about you" (contextBuilder.ts), separate from the raw
 *  facts/feedback logs already injected elsewhere. Read-and-consolidate
 *  only, same restraint as buildFactsContext below. */
export function buildContextInsightsSection(userId: string): string {
  const context = getContextProfile(userId);
  if (!context || context.insights.length === 0) return "";
  // Confidence-aware phrasing (spec: "ne jamais confondre profil et
  // vérité") — a low-confidence insight is labeled as a hypothesis, not
  // presented with the same weight as an established pattern.
  const fmt = (i: (typeof context.insights)[number]) => i.confidence >= 0.6 ? i.text : `${i.text} (hypothèse, pas encore confirmée)`;
  return `\n\nCONTEXTE CONSOLIDÉ (synthèse déjà construite à partir de l'historique réel de cet utilisateur — vues, demandes, retours ; PAS une simple liste de genres, cherche déjà les mécanismes) — ${context.insights.map(fmt).join(" ; ")}. Traite ceci comme une tendance de fond, pas une certitude absolue : une demande explicite de l'utilisateur prime toujours dessus (voir CORRECTION EXPLICITE > INFÉRENCE).`;
}

/** Compact context for the system prompt — read-and-consolidate only, never
 *  a trigger for background work (AI.MD closing note). */
export function buildFactsContext(userId: string): string {
  const facts = getFacts(userId);
  if (!facts.length) return "";
  return `\n\nFAITS RETENUS SUR CET UTILISATEUR (dits en conversation, à travers les sessions) — ${facts.map((f) => f.fact).join(" ; ")}. Utilise-les naturellement quand c'est pertinent (ex. l'appeler par son prénom s'il en a donné un), jamais comme une liste récitée.`;
}

const MAX_CORRECTION_ENTRIES = 50;
// 1 occurrence = weak signal, worth logging but not worth changing the
// model's behavior over (could be a genuine one-off mistake). 3 is where the
// spec's own "reinforced rule" language starts to apply — a plain count
// crossing a small threshold, surfaced as stronger prompt language, is the
// honest ceiling of what a prompt-based system (no real weights/training)
// can actually do with "this kept happening" (see module doc below).
const CORRECTION_ESCALATION_THRESHOLD = 3;

export function recordCorrection(userId: string, entry: Omit<AiCorrectionEntry, "at">): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const corrections = [...(profile.corrections ?? []), { ...entry, at: Date.now() }].slice(-MAX_CORRECTION_ENTRIES);
  store[userId] = { ...profile, corrections };
  write(store);
}

export function getCorrections(userId: string): AiCorrectionEntry[] {
  return profileForUser(read(), userId).corrections ?? [];
}

/** Escalation rule injected into the system prompt (chat/route.ts) when a
 *  user has corrected the assistant on the SAME kind of mistake enough
 *  times to be a real pattern, not a one-off (spec: "ne jamais confondre
 *  une correction ponctuelle d'un vrai pattern"). Deliberately just a count
 *  crossing CORRECTION_ESCALATION_THRESHOLD — no fake per-category
 *  confidence score, no root-cause classification (that would need a second
 *  LLM call diagnosing the first LLM's mistake, unreliable and explicitly
 *  out of scope here). Composes with, rather than replaces, the existing
 *  "NE JAMAIS INVENTER UNE SOURCE DE DONNÉES" rule already in
 *  buildSystemPrompt — this only makes that rule more insistent for THIS
 *  user, on THIS specific claim shape, once it's demonstrably a repeat
 *  problem for them. Empty (no prompt bloat) below the threshold. */
export function buildCorrectionEscalationContext(userId: string): string {
  const count = getCorrections(userId).filter((c) => c.category === "library_false_negative").length;
  if (count < CORRECTION_ESCALATION_THRESHOLD) return "";
  return `\n\nRAPPEL RENFORCÉ — CET UTILISATEUR T'A DÉJÀ CORRIGÉ ${count} FOIS sur le même type d'erreur : affirmer qu'un titre n'est PAS dans sa bibliothèque ("tu n'as pas X", "X n'est pas dans ta bibliothèque", "tu n'as jamais regardé X") alors que c'était faux. Ce n'est plus un incident isolé pour cet utilisateur précis — sois strictement plus prudent que la normale sur CE type d'affirmation précis (voir aussi la règle NE JAMAIS INVENTER UNE SOURCE DE DONNÉES ci-dessus) : si tu n'as pas, dans le contexte fourni plus haut, une donnée réelle et vérifiée sur ce titre précis pour CET utilisateur, ne présente JAMAIS son absence comme un fait établi — dis explicitement que tu ne peux pas le vérifier ici et oriente-le vers sa bibliothèque/recherche Movviz, plutôt que de risquer une nouvelle affirmation fausse.`;
}

/** Compact human-readable feedback summary for the system prompt — the
 *  assistant should already know what landed and what missed, even before
 *  the contrastive-learning brick turns this into weighted traits. Empty
 *  when the user hasn't voted on anything yet (no prompt bloat). */
export function buildFeedbackContext(userId: string): string {
  const feedback = getFeedback(userId);
  if (!feedback.length) return "";
  const liked = feedback.filter((e) => e.liked).slice(-8);
  const disliked = feedback.filter((e) => !e.liked).slice(-8);
  const fmt = (list: AiFeedbackEntry[]) => list.map((e) => (e.reason ? `${e.title} (${e.reason})` : e.title)).join(", ");
  const parts: string[] = [];
  if (liked.length) parts.push(`recommandations appréciées : ${fmt(liked)}`);
  if (disliked.length) parts.push(`recommandations rejetées : ${fmt(disliked)}`);
  return `\n\nRETOURS SUR RECOMMANDATIONS PASSÉES (👍/👎 de cet utilisateur) — ${parts.join(" ; ")}. N'insiste jamais sur un titre déjà rejeté ni sur un axe de recommandation explicitement écarté ; les titres appréciés indiquent le TYPE de lien à rechercher (mécanique d'humour, tension, ton), pas juste le genre.`;
}

// ---------------------------------------------------------------------------
// 1-5 star ratings (distinct from the binary 👍/👎 feedback log above — see
// TitleRating's own doc comment in types.ts for why only two priority tiers
// exist here, not the full source hierarchy a larger spec might describe).

const MAX_RATING_ENTRIES = 500;

export function getRating(userId: string, tmdbId: number, type: "movie" | "series"): TitleRating | null {
  const ratings = profileForUser(read(), userId).ratings ?? [];
  return ratings.find((r) => r.tmdbId === tmdbId && r.type === type && r.active !== false) ?? null;
}

export function getAllRatings(userId: string): TitleRating[] {
  return (profileForUser(read(), userId).ratings ?? []).filter((rating) => rating.active !== false);
}

/**
 * Records a rating. An `explicit` rating (the star widget, or an
 * unambiguous number stated in conversation — "je lui mets 4/5") always
 * becomes the current rating, overwriting whatever was there before. An
 * `inferred` one (the model interpreting a qualitative opinion —
 * "j'ai adoré") only becomes current when there's no EXISTING explicit
 * rating for this title: the attempt is still appended to `history` either
 * way (so a rejected inference is never silently lost, just not trusted
 * as the displayed number) — this is what "une note explicite prime
 * toujours sur une note déduite" (confirmed user requirement) means in
 * practice: it's not that inferred ratings are ignored, it's that they
 * never get to overrule a number the user actually chose.
 */
export function setRating(
  userId: string,
  entry: { tmdbId: number; type: "movie" | "series"; title: string; rating: number; source: RatingSource; confidence: number; opinion?: string; at?: number; origin?: RatingOrigin }
): TitleRating {
  const clampedRating = Math.min(5, Math.max(1, Math.round(entry.rating * 2) / 2));
  const clampedConfidence = entry.source === "explicit" ? 1 : Math.min(1, Math.max(0, entry.confidence));
  const store = read();
  const profile = profileForUser(store, userId);
  const ratings = profile.ratings ?? [];
  const idx = ratings.findIndex((r) => r.tmdbId === entry.tmdbId && r.type === entry.type);
  const existingBefore: number | null = idx === -1 ? null : ratings[idx].rating;
  const at = entry.at ?? Date.now();
  const origin = entry.origin ?? (entry.source === "inferred" ? "ai" : "movviz");
  // Explicit ratings are user mutations and therefore still obey LWW across
  // Movviz/Plex. An older Plex import must not overwrite a newer local click.
  if (idx >= 0 && entry.source === "explicit" && ratings[idx].updatedAt > at) return ratings[idx];
  const historyEntry = { rating: clampedRating, source: entry.source, confidence: clampedConfidence, at, opinion: entry.opinion, origin };

  let updated: TitleRating;
  if (idx === -1) {
    updated = {
      tmdbId: entry.tmdbId,
      type: entry.type,
      title: entry.title,
      rating: clampedRating,
      source: entry.source,
      confidence: clampedConfidence,
      opinion: entry.opinion,
      history: [historyEntry],
      updatedAt: at,
      active: true,
      clearedAt: null,
      origin,
    };
  } else {
    const existing = ratings[idx];
    // An inferred rating never overwrites an existing explicit one — still
    // logged to history (below) so the attempt isn't silently discarded,
    // just not surfaced as the title's current rating.
    const keepsExisting = existing.source === "explicit" && entry.source === "inferred";
    updated = keepsExisting
      ? { ...existing, history: [...existing.history, historyEntry].slice(-MAX_RATING_ENTRIES) }
      : {
          ...existing,
          title: entry.title,
          rating: clampedRating,
          source: entry.source,
          confidence: clampedConfidence,
          opinion: entry.opinion,
          history: [...existing.history, historyEntry].slice(-MAX_RATING_ENTRIES),
          updatedAt: at,
          active: true,
          clearedAt: null,
          origin,
        };
  }

  const nextRatings = idx === -1 ? [...ratings, updated] : ratings.map((r, i) => (i === idx ? updated : r));
  store[userId] = { ...profile, ratings: nextRatings };
  write(store);
  // Same dual-write as recordFeedback above — only when the rating actually
  // changed the DISPLAYED value (keepsExisting above means an inferred
  // attempt was appended to history but didn't become current; that's not
  // worth a ledger row, the explicit rating it lost to already has one).
  if (updated.rating !== existingBefore) {
    recordUserContextEvent({
      userId,
      eventType: idx === -1 ? "rating_set" : "rating_changed",
      source: "ai_ratings",
      sourceEventId: `rating:${userId}:${entry.type}:${entry.tmdbId}:${entry.source}:${historyEntry.at}`,
      tmdbId: entry.tmdbId,
      mediaType: entry.type,
      title: entry.title,
      numericValue: updated.rating,
      textValue: entry.source,
      occurredAt: historyEntry.at,
    });
  }
  return updated;
}

export function clearRating(userId: string, tmdbId: number, type: "movie" | "series", at = Date.now(), origin: RatingOrigin = "movviz"): void {
  const store = read();
  const profile = profileForUser(store, userId);
  const ratings = profile.ratings ?? [];
  const idx = ratings.findIndex((r) => r.tmdbId === tmdbId && r.type === type);
  if (idx < 0) return;
  ratings[idx] = { ...ratings[idx], active: false, clearedAt: at, updatedAt: at, origin };
  store[userId] = { ...profile, ratings };
  write(store);
  recordUserContextEvent({ userId, eventType: "rating_cleared", source: origin, sourceEventId: `rating-clear:${userId}:${type}:${tmdbId}:${at}`, tmdbId, mediaType: type, title: ratings[idx].title, occurredAt: at, textValue: origin });
}

/** Compact context for the system prompt — same restraint as
 *  buildFeedbackContext above (read-and-consolidate only). Only the
 *  clearly-rated extremes (4-5 and 1-2 stars) are surfaced by name; 3-star
 *  ("correct, sans plus") ratings are summarized as a count rather than
 *  listed, since they carry the least signal about what to recommend
 *  more/less of. */
export function buildRatingsContext(userId: string): string {
  const ratings = getAllRatings(userId);
  if (!ratings.length) return "";
  const loved = ratings.filter((r) => r.rating >= 4).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
  const disliked = ratings.filter((r) => r.rating <= 2).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
  const neutralCount = ratings.filter((r) => r.rating === 3).length;
  const fmt = (r: TitleRating) => `${r.title} (${r.rating}/5${r.source === "inferred" ? ", déduit" : ""})`;
  const parts: string[] = [];
  if (loved.length) parts.push(`très appréciés : ${loved.map(fmt).join(", ")}`);
  if (disliked.length) parts.push(`peu appréciés : ${disliked.map(fmt).join(", ")}`);
  if (neutralCount) parts.push(`${neutralCount} titre(s) noté(s) 3/5 (correct, sans plus)`);
  return `\n\nNOTES ATTRIBUÉES PAR CET UTILISATEUR (1 à 5 étoiles, sur ses propres titres — "déduit" = interprété d'une opinion en conversation, moins certain qu'une note explicite) — ${parts.join(" ; ")}. Une note ne dit pas seulement SI un titre a plu, mais À QUEL POINT — pondère tes recommandations et déductions de goût en conséquence (un 5/5 pèse plus qu'un 4/5), et ne présente jamais une note "déduite" comme si l'utilisateur l'avait lui-même choisie.`;
}

/** Cooldown for the proactive rating nudge (chat/route.ts
 *  pickProactiveRatingCandidate) — read/write pair, same shape as every
 *  other per-user timestamp in this file. */
export function getLastProactiveRatingAskAt(userId: string): number {
  return profileForUser(read(), userId).lastProactiveRatingAskAt ?? 0;
}

export function markProactiveRatingAsked(userId: string): void {
  const store = read();
  const profile = profileForUser(store, userId);
  store[userId] = { ...profile, lastProactiveRatingAskAt: Date.now() };
  write(store);
}
