import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { getFeedback } from "@/lib/ai/tasteProfile";
import type { ResolvedAiItem } from "@/lib/ai/actions";

/**
 * Recommendation Score (AI.MD §2.D/§2.E) — first pragmatic pass: separates
 * candidate GENERATION (the LLM proposes more titles than will be shown,
 * see the widened prompt guidance in actions.ts) from RANKING (Movviz
 * scores and orders them). No embeddings, no vector DB, no ML — every term
 * below is a plain, inspectable heuristic over data Movviz already has:
 * TMDb rating, library/request state, watch history, and the 👍/👎
 * feedback log this brick's predecessor started recording. Mood/taste
 * compatibility terms from the full spec formula are NOT implemented yet
 * (they need the Mood Engine brick) — this is intentionally a subset.
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
export function scoreCandidates(
  userId: string,
  candidates: ResolvedAiItem[],
  reasons: Map<string, string | undefined>,
  topN = 6
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

    if (pendingOrApproved.has(key)) score -= 15; // AlreadyRequested

    scored.push({ ...c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
