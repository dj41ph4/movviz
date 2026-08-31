import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { getSeriesByTmdbId } from "@/lib/library/store";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { moodSimilarity } from "@/lib/ai/titleAnalysis";
import type { TasteVector } from "@/lib/ai/contrastiveProfile";
import type { ResolvedAiItem } from "@/lib/ai/actions";
import type { AiMoodCategories } from "@/lib/ai/types";
import { getExplicitTitlePreferences } from "@/lib/userContext/preferences";

/**
 * Recommendation Score (AI.MD §2.D/§2.E) — separates candidate GENERATION
 * (the LLM proposes more titles than will be shown, see the widened prompt
 * guidance in actions.ts) from RANKING (Movviz scores and orders them). No
 * embeddings, no vector DB, no ML — every term below is a plain, inspectable
 * heuristic over data Movviz already has: TMDb rating, library/request
 * state, watch history, the 👍/👎 feedback log, mood similarity from the
 * Mood Engine (titleAnalysis.ts) when a reference title is available,
 * TasteCompatibility (contrastive learning over the feedback log,
 * contrastiveProfile.ts) and FranchiseAffinity (same TMDb collection as the
 * reference).
 */

/** Recommendation distance tiers (spec's "franchise tree" idea, §2/vague 2)
 *  — surfaced alongside the score so a caller (chat/route.ts, and
 *  eventually the UI) can explain the KIND of link, not just its rank.
 *  very_close = same franchise (continuation gets its own priority below,
 *  everything else in the collection still counts as very close). close/
 *  mood_match/conceptual_match are plain moodSimilarity(reference, candidate)
 *  bands. discovery = no usable reference at all (profile-only recommend) or
 *  a candidate whose mood has drifted far from the reference. */
export type RecommendationDistance = "very_close" | "close" | "mood_match" | "conceptual_match" | "discovery";

export interface ScoredCandidate extends ResolvedAiItem {
  score: number;
  distance: RecommendationDistance;
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

// Bug fix (audit finding #2, confirmed live): the old check excluded a
// series from ALL future recommendations after a single watched episode —
// contradicting this file's own "already fully watched" doc comment below.
// Mirrors the exact same principle already used for the manual "watched"
// toggle (TitleContent.tsx's seriesEpisodes/allSeriesWatched): only known
// (non-upcoming) episodes count, and ALL of them must be watched. Only
// applies to series already in the LIBRARY — Movviz doesn't know a
// non-library series's true episode count, and "possibly excluded because
// we can't tell" is worse than "not excluded, may resurface once" (spec
// §16: a single observation is weak signal, never a hard rule on its own).
export function isSeriesFullyWatched(tmdbId: number, watchedEpisodeKeys: Set<string>): boolean {
  const series = getSeriesByTmdbId(tmdbId);
  if (!series) return false;
  const known = series.seasons.flatMap((s) =>
    s.episodes.filter((e) => e.status !== "upcoming" && e.episodeNumber != null).map((e) => `${s.seasonNumber}.${e.episodeNumber}`)
  );
  return known.length > 0 && known.every((k) => watchedEpisodeKeys.has(k));
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

/** Same TMDb collection as the reference, PLUS which of its tmdbIds is the
 *  next installment the user hasn't seen/owned yet (spec: franchise
 *  continuation is an important signal, but it's the NEXT one that should
 *  actually jump the queue — not just "any entry in this saga"). */
export interface FranchiseContext {
  tmdbIds: Set<number>;
  nextTmdbId?: number;
}

/** Content fatigue (spec §2/vague 2 "recentExposure") — a mood profile
 *  averaged over the user's own recently watched titles (cache-only, same
 *  restraint as TasteCompatibility: never triggers a new LLM analysis just
 *  to build this) plus how much weight to give it. A candidate whose mood
 *  strongly resembles what's already been binged very recently gets a small
 *  temporary nudge down — never excluded, never a hard rule, just a light
 *  thumb on the scale (spec §16: a handful of recent watches is still a
 *  weak signal on its own). */
export interface FatigueContext {
  profile: AiMoodCategories;
  strength: number;
}

export function scoreCandidates(
  userId: string,
  candidates: ResolvedAiItem[],
  reasons: Map<string, string | undefined>,
  topN = 6,
  mood?: MoodContext,
  tasteVector?: TasteVector | null,
  franchise?: FranchiseContext,
  fatigue?: FatigueContext
): ScoredCandidate[] {
  const watch = getWatchStatus(userId);
  const watchedMovies = new Set(watch?.movies ?? []);
  const watchedEpisodesBySeries = new Map<number, Set<string>>();
  for (const e of watch?.episodes ?? []) {
    const set = watchedEpisodesBySeries.get(e.tmdbId) ?? new Set<string>();
    set.add(`${e.season}.${e.episode}`);
    watchedEpisodesBySeries.set(e.tmdbId, set);
  }

  const pendingOrApproved = new Set(
    loadRequests()
      .filter((r) => r.userId === userId && (r.status === "pending" || r.status === "approved"))
      .map((r) => `${r.type}:${r.tmdbId}`)
  );

  const feedback = getFeedback(userId);
  const likedTokens = feedback.filter((f) => f.liked && f.reason).map((f) => tokenize(f.reason!));
  const dislikedTokens = feedback.filter((f) => !f.liked && f.reason).map((f) => tokenize(f.reason!));
  // This EXACT title (tmdbId+type), previously 👎'd — a hard exclude,
  // distinct from the soft reason-token penalty above (which only
  // discourages SIMILAR candidates, and does nothing if the model's new
  // "reason" happens to share no wording with the old one). Confirmed live
  // pattern this session: relying on the model's own memory of what it
  // already proposed isn't reliable — this makes "never re-propose a
  // rejected title" an actual guarantee instead of a prompt hope.
  const dislikedExactKeys = new Set(feedback.filter((f) => !f.liked).map((f) => `${f.type}:${f.tmdbId}`));
  const explicitPreferences = new Map(
    getExplicitTitlePreferences(userId, 500).map((pref) => [pref.key, pref] as const)
  );

  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.type}:${c.tmdbId}`;
    const alreadySeen = c.type === "movie"
      ? watchedMovies.has(c.tmdbId)
      : isSeriesFullyWatched(c.tmdbId, watchedEpisodesBySeries.get(c.tmdbId) ?? new Set());
    if (alreadySeen) continue; // AlreadySeen — hard exclude, per spec (series: fully watched only, see isSeriesFullyWatched)
    if (dislikedExactKeys.has(key)) continue; // AlreadyRejected — hard exclude, never re-propose the same rejected title
    const explicitPreference = explicitPreferences.get(key);
    if (explicitPreference && explicitPreference.affinity <= -0.75) continue; // explicit correction wins

    const reason = reasons.get(key);
    const reasonTokens = reason ? tokenize(reason) : null;

    let score = 0;
    score += Math.max(0, c.rating) * 2; // Quality — up to ~20
    if (!c.inLibrary) score += 8; // Novelty — favors real discoveries over what's already owned
    if (explicitPreference) score += explicitPreference.affinity * 20 * explicitPreference.confidence;

    if (reasonTokens) {
      // Bug fix (audit finding #3, confirmed live): each individual match
      // was capped at ±6, but the sum across the WHOLE feedback log (up to
      // 200 entries) had no overall ceiling — contradicting the documented
      // ±18 cap and letting this term silently dwarf Quality/MoodSimilarity
      // as feedback history grows. Now capped exactly like AI.MD describes.
      let likedBonus = 0;
      let dislikedPenalty = 0;
      for (const liked of likedTokens) likedBonus += Math.min(6, overlapCount(reasonTokens, liked) * 3);
      for (const disliked of dislikedTokens) dislikedPenalty += Math.min(6, overlapCount(reasonTokens, disliked) * 3);
      score += Math.min(18, likedBonus);
      score -= Math.min(18, dislikedPenalty);
    }

    const candidateMood = mood?.candidates.get(key);
    let moodSim: number | null = null;
    if (mood && candidateMood) {
      moodSim = moodSimilarity(mood.reference, candidateMood);
      score += moodSim * 25; // MoodSimilarity — up to 25, the dominant term when available (matches the spec's own example weighting)
    }

    if (tasteVector && candidateMood) {
      // TasteCompatibility (§2.H, real contrastive learning): reward
      // closeness to what the user has ACTUALLY liked before, penalize
      // closeness to what they've explicitly rejected — the same trait can
      // score very differently depending on which side of past feedback it
      // resembles more, which is the whole point of contrastive signal
      // over a flat "likes X genre" summary. Scaled by confidence (vague 2):
      // a vector built from one or two analyzed titles shouldn't swing the
      // score as hard as one built from a dozen.
      score += moodSimilarity(tasteVector.liked, candidateMood) * 15 * tasteVector.confidence;
      score -= moodSimilarity(tasteVector.disliked, candidateMood) * 15 * tasteVector.confidence;
    }

    // Franchise continuation (vague 2) — the NEXT unwatched installment
    // gets its own, stronger bonus than just "somewhere in this saga",
    // matching the spec's Scary Movie worked example (recognize continuity,
    // never force it — this only ever ADDS score, it can't exclude anything).
    let franchiseBonus = 0;
    if (c.type === "movie" && franchise?.tmdbIds.has(c.tmdbId)) {
      franchiseBonus = franchise.nextTmdbId === c.tmdbId ? 20 : 10;
      score += franchiseBonus;
    }

    // Content fatigue (vague 2, spec "recentExposure") — light, never a hard
    // exclusion, and only applied once there's at least a real mood profile
    // to compare against.
    if (fatigue && candidateMood && fatigue.strength > 0) {
      score -= moodSimilarity(fatigue.profile, candidateMood) * fatigue.strength * 8;
    }

    if (pendingOrApproved.has(key)) score -= 15; // AlreadyRequested

    let distance: RecommendationDistance;
    if (franchiseBonus > 0) distance = "very_close";
    else if (moodSim == null) distance = "discovery";
    else if (moodSim >= 0.72) distance = "close";
    else if (moodSim >= 0.5) distance = "mood_match";
    else if (moodSim >= 0.3) distance = "conceptual_match";
    else distance = "discovery";

    scored.push({ ...c, score, distance });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
