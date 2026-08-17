import { getFeedback, getAllRatings } from "@/lib/ai/tasteProfile";
import { getCachedMoodProfile } from "@/lib/ai/titleAnalysis";
import type { AiMoodCategories } from "@/lib/ai/types";

/**
 * Real contrastive learning over the 👍/👎 log (AI.MD §2.H) — the piece the
 * earlier feedback brick deliberately left undone ("this brick only
 * captures and surfaces the raw signal"). Builds two averaged mood
 * profiles — one from liked titles, one from disliked ones — so a
 * candidate can be compared against BOTH: high similarity to "liked" AND
 * low similarity to "disliked" is what real contrastive learning means
 * (Scary Movie 👍 + Naked Gun 👍 + Airplane! 👎 → learn the TYPE of parody
 * that lands, not just "likes parody"). No ML, no vectors beyond the same
 * plain per-trait averaging the Mood Engine already uses.
 */
export interface TasteVector {
  liked: AiMoodCategories;
  disliked: AiMoodCategories;
  /** How much weight this vector deserves (0..1) — grows with the amount of
   *  analyzed feedback behind it. A single 👍/👎 with a cached mood profile
   *  is a weak signal (spec §16/§2.F: "never a single action = absolute
   *  truth"), so the contrastive term in recommendationScore.ts is scaled by
   *  this instead of always applying at full strength. Saturates at 6
   *  analyzed titles on either side — plenty to trust the average without
   *  requiring an unrealistic amount of feedback first. */
  confidence: number;
  /** Titles that actually contributed to each side — lets an explanation
   *  reference real evidence instead of an unfalsifiable "you seem to
   *  like X" (spec §2.T/§39). Capped, most recent-looking first isn't
   *  tracked here (feedback order is preserved as-is). */
  evidence: { liked: string[]; disliked: string[] };
}

export function averageProfiles(profiles: AiMoodCategories[]): AiMoodCategories {
  const sums: Record<string, Record<string, { sum: number; n: number }>> = {};
  for (const profile of profiles) {
    for (const [category, traits] of Object.entries(profile)) {
      sums[category] ??= {};
      for (const [trait, value] of Object.entries(traits)) {
        sums[category][trait] ??= { sum: 0, n: 0 };
        sums[category][trait].sum += value;
        sums[category][trait].n += 1;
      }
    }
  }
  const out: AiMoodCategories = {};
  for (const [category, traits] of Object.entries(sums)) {
    out[category] = {};
    for (const [trait, { sum, n }] of Object.entries(traits)) out[category][trait] = sum / n;
  }
  return out;
}

/** Only titles that ALREADY have a cached Mood Engine profile contribute —
 *  this never triggers a new analysis just to build the vector (AI.MD: no
 *  background LLM work). As more titles get analyzed through normal
 *  recommend usage, the vector quietly gets richer on its own. Returns
 *  null when there isn't enough signal yet (no feedback with an analyzed
 *  title on either side). */
const CONFIDENCE_SATURATION = 6;
const MAX_EVIDENCE = 5;

export function buildTasteVector(userId: string): TasteVector | null {
  const feedback = getFeedback(userId);
  const likedProfiles: AiMoodCategories[] = [];
  const dislikedProfiles: AiMoodCategories[] = [];
  const likedTitles: string[] = [];
  const dislikedTitles: string[] = [];
  // Titles with a 1-5 rating are a richer signal than the binary 👍/👎 log
  // (spec: "une note ne dit pas seulement SI un titre a plu, mais À QUEL
  // POINT") — a 5/5 or 1/5 counts twice toward the average, a 4/5 or 2/5
  // once, a 3/5 (neutral) contributes to neither side. Deduped against
  // `feedback` by tmdbId+type below so the same title never double-counts
  // through both signals — the rating wins when both exist, since it's the
  // more informative one.
  const ratedKeys = new Set<string>();
  for (const rating of getAllRatings(userId)) {
    if (rating.rating === 3) continue;
    const profile = getCachedMoodProfile(rating.type, rating.tmdbId);
    if (!profile) continue;
    ratedKeys.add(`${rating.type}:${rating.tmdbId}`);
    const weight = rating.rating === 5 || rating.rating === 1 ? 2 : 1;
    if (rating.rating >= 4) {
      for (let i = 0; i < weight; i++) likedProfiles.push(profile.categories);
      if (likedTitles.length < MAX_EVIDENCE) likedTitles.push(rating.title);
    } else {
      for (let i = 0; i < weight; i++) dislikedProfiles.push(profile.categories);
      if (dislikedTitles.length < MAX_EVIDENCE) dislikedTitles.push(rating.title);
    }
  }
  for (const entry of feedback) {
    if (ratedKeys.has(`${entry.type}:${entry.tmdbId}`)) continue;
    const profile = getCachedMoodProfile(entry.type, entry.tmdbId);
    if (!profile) continue;
    if (entry.liked) {
      likedProfiles.push(profile.categories);
      if (likedTitles.length < MAX_EVIDENCE) likedTitles.push(entry.title);
    } else {
      dislikedProfiles.push(profile.categories);
      if (dislikedTitles.length < MAX_EVIDENCE) dislikedTitles.push(entry.title);
    }
  }
  const contributing = likedProfiles.length + dislikedProfiles.length;
  if (contributing === 0) return null;
  return {
    liked: averageProfiles(likedProfiles),
    disliked: averageProfiles(dislikedProfiles),
    confidence: Math.min(1, contributing / CONFIDENCE_SATURATION),
    evidence: { liked: likedTitles, disliked: dislikedTitles },
  };
}
