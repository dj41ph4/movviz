import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { moodSimilarity } from "@/lib/ai/titleAnalysis";
import type { ResolvedAiItem } from "@/lib/ai/actions";
import type { AiMoodCategories } from "@/lib/ai/types";

/**
 * Recommendation Score (AI.MD §2.D/§2.E) — separates candidate GENERATION
 * (the LLM proposes more titles than will be shown, see the widened prompt
 * guidance in actions.ts) from RANKING (Movviz scores and orders them). No
 * embeddings, no vector DB, no ML — every term below is a plain, inspectable
 * heuristic over data Movviz already has: TMDb rating, library/request
 * state, watch history, the 👍/👎 feedback log, and — when a reference
 * title is available (see MoodContext) — mood similarity from the Mood
 * Engine (titleAnalysis.ts). TasteCompatibility/FranchiseAffinity from the
 * full spec formula are still not implemented (they need a longer feedback
 * history than this early stage has to work with).
 */

export interface ScoredCandidate extends ResolvedAiItem {
  score: number;
}

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "avec", "sans",
  "dans", "sur", "pour", "par", "qui", "que", "quoi", "au", "aux", "ce", "cette",
  "ces", "son", "sa", "ses", "leur", "leurs", "plus", "moins", "très", "bien",
  "même", "comme", "mais", "car", "donc", "est", "sont", "être", "avoir", "the",
  "a", "an", "of", "and", "or", "with", "for", "to", "is", "are",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * Scores and ranks resolved candidates for one user, EXCLUDING titles
 * already fully watched (the spec's explicit rule: never re-propose
 * something already seen unless the user asks again — enforced here, not
 * left to the LLM's memory). `reasons` maps `type:tmdbId` → the reason the
 * LLM gave for that specific candidate, used both for display and for the
 * feedback-overlap term below.
 */
export interface MoodContext {
  /** The mood profile of the title the user is currently referencing
   *  (e.g. the page they're browsing) — absent when there's no clear
   *  reference, in which case the mood term is simply omitted. */
  reference: AiMoodCategories;
  /** Each candidate's own analyzed mood profile, keyed "type:tmdbId" —
   *  only entries that were actually analyzed/cached in time are present;
   *  a missing entry just skips the mood term for that one candidate. */
  candidates: Map<string, AiMoodCategories>;
}

export function scoreCandidates(
  userId: string,
  candidates: ResolvedAiItem[],
  reasons: Map<string, string | undefined>,
  topN = 6,
  mood?: MoodContext
): ScoredCandidate[] {
  const watch = getWatchStatus(userId);
  const watchedMovies = new Set(watch?.movies ?? []);
  const watchedSeries = new Set((watch?.episodes ?? []).map((e) => e.tmdbId));

  const pendingOrApproved = new Set(
    loadRequests()
      .filter((r) => r.userId === userId && (r.status === "pending" || r.status === "approved"))
      .map((r) => `${r.type}:${r.tmdbId}`)
  );

  const feedback = getFeedback(userId);
  const likedTokens = feedback.filter((f) => f.liked && f.reason).map((f) => tokenize(f.reason!));
  const dislikedTokens = feedback.filter((f) => !f.liked && f.reason).map((f) => tokenize(f.reason!));

  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.type}:${c.tmdbId}`;
    if (c.type === "movie" ? watchedMovies.has(c.tmdbId) : watchedSeries.has(c.tmdbId)) continue; // AlreadySeen — hard exclude, per spec

    const reason = reasons.get(key);
    const reasonTokens = reason ? tokenize(reason) : null;

    let score = 0;
    score += Math.max(0, c.rating) * 2; // Quality — up to ~20
    if (!c.inLibrary) score += 8; // Novelty — favors real discoveries over what's already owned

    if (reasonTokens) {
      for (const liked of likedTokens) score += Math.min(6, overlapCount(reasonTokens, liked) * 3);
      for (const disliked of dislikedTokens) score -= Math.min(6, overlapCount(reasonTokens, disliked) * 3);
    }

    if (mood) {
      const candidateMood = mood.candidates.get(key);
      if (candidateMood) score += moodSimilarity(mood.reference, candidateMood) * 25; // MoodSimilarity — up to 25, the dominant term when available (matches the spec's own example weighting)
    }

    if (pendingOrApproved.has(key)) score -= 15; // AlreadyRequested

    scored.push({ ...c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
