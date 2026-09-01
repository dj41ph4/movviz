import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { getFeedback, getFacts, getContextProfile, saveContextInsights, getAllRatings } from "@/lib/ai/tasteProfile";
import { buildUsageProfile } from "@/lib/ai/profile";
import { callAi } from "@/lib/ai/providers";
import { loadAiConfig } from "@/lib/ai/store";
import { extractJsonObject } from "@/lib/ai/intentParser";
import type { AiConfig, AiContextInsight } from "./types";

/**
 * "Créer mon contexte" (demande explicite user, panneau profil) — a single
 * dedicated LLM pass that reads the user's REAL Movviz activity (watched
 * titles, requests, 👍/👎 feedback, facts already known) and synthesizes a
 * handful of durable, concrete insights — the "nice base" the user asked
 * for, which the ongoing conversation then keeps quietly topping up
 * (mergeIncremental below) rather than rebuilding from scratch every time.
 * Same restraint as the rest of the AI feature: ONE LLM call per build, only
 * ever triggered by a real request (the button, or the cheap gate in
 * session/route.ts) — never a poller, never analyzes anything the user
 * hasn't actually done in Movviz.
 */
const CONTEXT_SYSTEM_PROMPT = `Tu analyses l'activité RÉELLE d'un utilisateur de Movviz (films/séries vus, demandes faites, retours 👍/👎 donnés, faits déjà connus) pour synthétiser ce qu'on peut concrètement en déduire sur ses goûts et ses habitudes — jamais une simple liste de genres favoris. Réponds UNIQUEMENT avec un objet JSON de la forme {"insights":[{"text":"...","confidence":0.8,"evidenceCount":5,"trend":"stable"}]}, sans texte autour, sans balise de code.

CHAMPS DE CHAQUE INSIGHT :
- text : UNE phrase courte et concrète, DIRECTEMENT soutenue par les données fournies plus bas — jamais une généralité du type "aime les films d'action".
- confidence : entre 0 et 1, ta propre estimation de solidité (peu de données/un seul indice → bas ; motif qui revient sur plusieurs titres/plusieurs signaux → haut).
- evidenceCount : nombre approximatif d'éléments concrets (titres, demandes, votes) qui soutiennent CET insight précis dans les données fournies.
- trend : "emergente" (premier signal), "stable" (déjà établi, rien de neuf), ou "en_baisse" (contredit par des signaux plus récents) — utilise le champ "insights déjà établis" ci-dessous pour juger.

RÈGLES :
- 5 à 10 insights, cherchant le MÉCANISME ou l'HABITUDE plutôt que le genre brut : type d'humour ou de tension recherché (absurdité, second degré, noirceur...), structure narrative préférée, personnages/dynamique de groupe, rythme de visionnage (binge vs étalé), comportement face aux franchises (termine-t-il ses sagas ou change-t-il en cours de route ?), comportement face aux recommandations (accepte/ignore souvent quoi), contradictions éventuelles, préférences fortes ET préférences faibles.
- Cherche le POURQUOI un contenu semble fonctionner, pas juste le CONSTAT. Exemple : Scary Movie ne se résume jamais à "aime les comédies" — cherche plutôt "semble apprécier la parodie absurde, le détournement de codes connus, les gags visuels et les références à d'autres œuvres", ce qui permettrait ensuite de rapprocher des titres comme Naked Gun/Hot Shots!/Airplane!/Spaceballs même sans genre TMDb identique.
- N'invente RIEN qui ne soit pas soutenu par les données ci-dessous. Si un axe n'a pas assez de matière, n'en parle simplement pas — un profil incomplet honnête vaut mieux qu'un profil complet halluciné.
- Ne te contente jamais de reformuler un fait déjà donné tel quel (ex. ne redis pas juste "a regardé Le Seigneur des Anneaux") — dégage un vrai PATTERN qui ressort de PLUSIEURS éléments.
- Si des "insights déjà établis" sont fournis, ne les recopie pas à l'identique : soit tu les retrouves avec un trend "stable"/"en_baisse" ajusté, soit tu n'en parles pas et tu te concentres sur ce qui est vraiment nouveau.`;

function buildAnalysisInput(userId: string, existingInsights: string[]): string {
  const watch = getWatchStatus(userId);
  const usage = buildUsageProfile(userId);
  const requests = loadRequests().filter((r) => r.userId === userId);
  const feedback = getFeedback(userId);
  const facts = getFacts(userId);

  const parts: string[] = [];
  parts.push(`Films vus : ${usage.watchedMovies} · séries suivies : ${usage.watchedSeries} (${usage.watchedEpisodes} épisodes)`);
  if (usage.topSeries.length) {
    parts.push(`Séries les plus regardées : ${usage.topSeries.map((s) => `${s.title} (${s.episodes} ép.)`).join(", ")}`);
  }
  const recent = (watch?.recent ?? []).slice(0, 30);
  if (recent.length) {
    parts.push(`Derniers titres vus (avec date) : ${recent.map((r) => `${r.title} [${r.type === "movie" ? "film" : "série"}]`).join(", ")}`);
  }
  if (requests.length) {
    parts.push(`Demandes faites : ${requests.slice(-30).map((r) => `${r.title} (${r.status})`).join(", ")}`);
  }
  if (feedback.length) {
    const liked = feedback.filter((f) => f.liked).map((f) => f.title);
    const disliked = feedback.filter((f) => !f.liked).map((f) => f.title);
    if (liked.length) parts.push(`Recommandations appréciées : ${liked.join(", ")}`);
    if (disliked.length) parts.push(`Recommandations rejetées : ${disliked.join(", ")}`);
  }
  if (facts.length) parts.push(`Faits déjà connus (conversation) : ${facts.map((f) => f.fact).join(" ; ")}`);
  // Ratings (1-5 étoiles) — signal plus riche que le simple 👍/👎 ("une note
  // ne dit pas seulement SI un titre a plu, mais À QUEL POINT", même
  // logique que buildRatingsContext/tasteProfile.ts), jusqu'ici absent de
  // cette synthèse alors que le panneau profil l'affiche déjà (usage
  // ratings) — confirmé en direct : ce bouton doit prendre en compte TOUT
  // ce que le moteur de contexte sait, pas un sous-ensemble.
  const ratings = getAllRatings(userId);
  if (ratings.length) {
    const loved = ratings.filter((r) => r.rating >= 4).map((r) => `${r.title} (${r.rating}/5)`);
    const disliked = ratings.filter((r) => r.rating <= 2).map((r) => `${r.title} (${r.rating}/5)`);
    if (loved.length) parts.push(`Notes hautes (1-5 étoiles) : ${loved.join(", ")}`);
    if (disliked.length) parts.push(`Notes basses (1-5 étoiles) : ${disliked.join(", ")}`);
  }
  // Affinité de genre calculée (userContext/taste.ts) — inclut désormais les
  // vues (fiches ouvertes) en plus des vues/notes/votes/demandes, le seul
  // endroit qui agrège TOUT le signal en une phrase déjà pondérée plutôt que
  // de faire deviner le pattern au modèle à partir des listes brutes ci-dessus.
  if (usage.tasteEvidenceContext) parts.push(`Affinité de genre déjà calculée (vues, notes, votes, demandes) : ${usage.tasteEvidenceContext}`);
  if (existingInsights.length) parts.push(`Insights déjà établis (ne pas répéter à l'identique) : ${existingInsights.join(" ; ")}`);
  return parts.join("\n");
}

const VALID_TRENDS = new Set(["emergente", "stable", "en_baisse"]);

/** Same trust posture as the Mood Engine's own trait weights
 *  (titleAnalysis.ts validateCategories): the model's own numbers, never
 *  taken at face value — clamped to a sane range and structurally
 *  validated before anything is persisted. */
function validateInsights(raw: unknown, source: "bootstrap" | "incremental"): AiContextInsight[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as Record<string, unknown>).insights;
  if (!Array.isArray(list)) return [];
  const now = Date.now();
  const out: AiContextInsight[] = [];
  for (const raw2 of list.slice(0, 10)) {
    if (!raw2 || typeof raw2 !== "object") continue;
    const item = raw2 as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text.trim().slice(0, 300) : "";
    if (!text) continue;
    const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.4;
    const evidenceCount = typeof item.evidenceCount === "number" && Number.isFinite(item.evidenceCount) ? Math.max(1, Math.min(999, Math.round(item.evidenceCount))) : 1;
    const trend = typeof item.trend === "string" && VALID_TRENDS.has(item.trend) ? (item.trend as AiContextInsight["trend"]) : "emergente";
    out.push({ text, confidence, evidenceCount, trend, at: now, source });
  }
  return out;
}

/** Runs the analysis once and returns validated insights — never throws,
 *  returns null on any failure (no key, quota, malformed JSON, disabled). */
async function synthesize(config: AiConfig, userId: string, source: "bootstrap" | "incremental"): Promise<AiContextInsight[] | null> {
  if (!config.enabled) return null;
  try {
    const existing = source === "incremental" ? (getContextProfile(userId)?.insights.map((i) => i.text) ?? []) : [];
    const input = buildAnalysisInput(userId, existing);
    if (!input.trim()) return null; // nothing real to analyze yet
    const { text } = await callAi(config, CONTEXT_SYSTEM_PROMPT, [{ role: "user", content: input }]);
    const json = extractJsonObject(text);
    const insights = validateInsights(json, source);
    return insights.length > 0 ? insights : null;
  } catch {
    return null;
  }
}

/** Bootstrap pass — the profile-page button. Replaces any prior context
 *  wholesale (the user explicitly asked to (re)build it). */
export function buildContext(config: AiConfig, userId: string): Promise<AiContextInsight[] | null> {
  return synthesize(config, userId, "bootstrap");
}

/** Incremental pass — tops up an EXISTING context with what's new since the
 *  last build, merged rather than replaced. Callers gate how often this
 *  actually runs (see maybeUpdateContextIncrementally, session/route.ts). */
export function buildIncrementalContext(config: AiConfig, userId: string): Promise<AiContextInsight[] | null> {
  return synthesize(config, userId, "incremental");
}

// Demande explicite user ("auto learning... apprendre de CHAQUE action sans
// rien demander") — lowered from the original 3 signals / 24h so the
// consolidated context reacts close to "every action" in practice, not once
// a day. Still never truly "per action": a single new signal is enough to
// qualify, but the cooldown coalesces a burst (e.g. bingeing 6 episodes in
// an hour) into ONE LLM call instead of six — the actual restraint this
// codebase cares about (AI.MD: never a permanent/continuous LLM process)
// was always the "one call, not one per event" part, never the specific
// numbers. 30 min still means a normal viewing session gets topped up
// before it's even over, while a burst of activity in the same minute
// doesn't fire the model six times in a row.
const INCREMENTAL_MIN_NEW_ACTIVITY = 1;
const INCREMENTAL_COOLDOWN_MS = 30 * 60 * 1000;

/** Cheap, synchronous-ish gate for whether an incremental pass is due —
 *  only counts timestamps that are already in memory (no extra fs reads
 *  beyond what getWatchStatus/loadRequests already do), so this is safe to
 *  call opportunistically on a real request without turning into a poller.
 *  Requires a bootstrap to already exist — this never substitutes for the
 *  user's own first "Créer mon contexte" click. */
export function isIncrementalContextDue(userId: string): boolean {
  const context = getContextProfile(userId);
  if (!context || context.builtAt === 0) return false;
  if (Date.now() - context.builtAt < INCREMENTAL_COOLDOWN_MS) return false;
  const watch = getWatchStatus(userId);
  const newWatched = (watch?.recent ?? []).filter((r) => r.at > context.builtAt).length;
  const newRequests = loadRequests().filter((r) => r.userId === userId && r.createdAt > context.builtAt).length;
  const newFeedback = getFeedback(userId).filter((f) => f.at > context.builtAt).length;
  const newRatings = getAllRatings(userId).filter((r) => r.updatedAt > context.builtAt).length;
  return newWatched + newRequests + newFeedback + newRatings >= INCREMENTAL_MIN_NEW_ACTIVITY;
}

/**
 * Shared trigger, callable from every real write-path that represents "the
 * user just did something" (watch toggle, direct playback, 👍/👎 feedback,
 * a finished Netflix import) — not just the chat/session endpoints, so the
 * consolidated context actually reacts to an action the moment it happens
 * instead of waiting for the user to next open the chat widget. Still just
 * a gate check + at most one LLM call, still fire-and-forget from every
 * caller, still best-effort (never throws, never blocks the caller's own
 * response).
 */
export async function triggerIncrementalContextIfDue(userId: string): Promise<void> {
  if (!isIncrementalContextDue(userId)) return;
  const config = loadAiConfig();
  if (!config.enabled) return;
  try {
    const insights = await buildIncrementalContext(config, userId);
    if (insights) saveContextInsights(userId, insights, true);
  } catch {
    // Best-effort — a missed top-up just means the next due check retries.
  }
}
