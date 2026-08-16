import { getFeedback } from "@/lib/ai/tasteProfile";
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
export function buildTasteVector(userId: string): TasteVector | null {
  const feedback = getFeedback(userId);
  const likedProfiles: AiMoodCategories[] = [];
  const dislikedProfiles: AiMoodCategories[] = [];
  for (const entry of feedback) {
    const profile = getCachedMoodProfile(entry.type, entry.tmdbId);
    if (!profile) continue;
    (entry.liked ? likedProfiles : dislikedProfiles).push(profile.categories);
  }
  if (likedProfiles.length === 0 && dislikedProfiles.length === 0) return null;
  return { liked: averageProfiles(likedProfiles), disliked: averageProfiles(dislikedProfiles) };
}
