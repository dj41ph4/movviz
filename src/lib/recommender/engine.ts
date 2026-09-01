import { getMovieRecommendations, getTvRecommendations, getGenres } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { mapWithConcurrency } from "@/lib/concurrency";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getCachedMoodProfile, moodSimilarity } from "@/lib/ai/titleAnalysis";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getComputedGenreTraits, matchGenreAffinity } from "@/lib/userContext/taste";
import type { MetaSearchResult } from "@/lib/metadata/types";

/** Above this, the SQL context engine's genre affinity (userContext/taste.ts
 *  — watches/ratings/feedback/requests/views, all folded into one strength×
 *  confidence score) is treated as decisive: the candidate is pinned ahead
 *  of TMDb's own "similar to what you watched" ranking rather than merely
 *  nudged by it. Deliberately near the ceiling (confidence alone caps at
 *  0.96 — see getComputedGenreTraits) so this only fires on a genuinely
 *  strong, well-evidenced match, never a casual one. */
const GENRE_AFFINITY_PROMOTE_THRESHOLD = 0.95;

// Strictly per-account: this row is built ONLY from the target account's own
// Plex watch history — never blended with what any other account has
// watched, even a single other title. Two accounts on the same instance must
// never influence each other's "for you" row. Confirmed explicitly with the
// user after an earlier attempt at cross-account blending — even a single
// watched title of one's own is used as a real (if narrow) personal seed
// rather than falling back to a generic list once there's at least one.
export async function getRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  const owned = new Set<number>(
    (type === "movie" ? loadMovies() : loadSeries()).map((m) => m.tmdbId)
  );

  const status = getWatchStatus(userId);
  const watched: number[] =
    type === "movie"
      ? (status?.movies ?? [])
      : [...new Set((status?.episodes ?? []).map((e) => e.tmdbId))];

  if (watched.length === 0) return [];

  // "Mauvaise recommandation" (👎 sur une carte de cette rangée) recorded a
  // feedback entry but this engine never read it back — the same title kept
  // resurfacing here indefinitely, even though the AI chat's own ranking
  // (recommendationScore.ts) already hard-excludes it via this exact log.
  // Only tmdbId+type is used here (never the reason/mood-similarity terms
  // recommendationScore.ts also applies) — this row has no LLM-authored
  // "reason" per candidate to compare against, just a flat exclude list.
  const dislikedTmdbIds = new Set(
    getFeedback(userId).filter((f) => !f.liked && f.type === type).map((f) => f.tmdbId)
  );

  const excluded = new Set<number>([...watched, ...owned, ...dislikedTmdbIds]);
  const seeds = watched.slice(0, 25);

  const fetchFn = type === "movie" ? getMovieRecommendations : getTvRecommendations;
  const results = await mapWithConcurrency(seeds, 5, async (id) => {
    try { return await fetchFn(id); } catch { return null; }
  });

  const score = new Map<number, { item: MetaSearchResult; count: number }>();
  for (const r of results) {
    if (!r) continue;
    for (const item of r.results) {
      if (excluded.has(item.tmdbId)) continue;
      const existing = score.get(item.tmdbId);
      if (existing) {
        existing.count++;
      } else {
        score.set(item.tmdbId, { item, count: 1 });
      }
    }
  }

  const entries = [...score.values()];
  const maxCount = Math.max(1, ...entries.map((s) => s.count));

  // Same TasteCompatibility signal chat recommendations already use
  // (contrastiveProfile.ts/recommendationScore.ts) — reusing it here is the
  // whole point of "une seule source de vérité" (Discover must consume the
  // Context Engine, never grow its own separate taste model). Only cached
  // Mood Engine profiles are read (getCachedMoodProfile), so this never
  // triggers a new LLM analysis just to rank a Discover row — a candidate
  // without a cached profile simply gets no taste term, never a penalty.
  const tasteVector = buildTasteVector(userId);

  // Middleware between the TMDb candidate engine and the SQL context: every
  // candidate here already carries real genre_ids (mapPaged() sets them
  // unconditionally, recommendations included — confirmed by reading it,
  // not assumed), so they can be matched against the SAME per-user genre
  // affinity recommendationScore.ts (AI chat) now uses, via the shared
  // matchGenreAffinity() middleware in userContext/taste.ts. Without this,
  // everything wired into the context engine this session (views, votes,
  // ratings, requests all feeding genre affinity) would still never reach
  // the one row most people actually look at — "Suggestions pour vous".
  const genreTraits = new Map(getComputedGenreTraits(userId, 10).map((t) => [t.key, t] as const));
  const genreNameById = genreTraits.size
    ? new Map((await getGenres(type)).map((g) => [g.id, g.name] as const))
    : new Map<number, string>();

  const ranked = entries
    .map((s) => {
      let taste = 0;
      if (tasteVector) {
        const candidateMood = getCachedMoodProfile(type, s.item.tmdbId)?.categories;
        if (candidateMood) {
          taste = (moodSimilarity(tasteVector.liked, candidateMood) - moodSimilarity(tasteVector.disliked, candidateMood)) * tasteVector.confidence;
        }
      }
      const genreNames = genreNameById.size
        ? (s.item.genreIds ?? []).map((id) => genreNameById.get(id)).filter((n): n is string => !!n)
        : [];
      const affinity = genreNames.length ? matchGenreAffinity(genreNames, genreTraits) : 0;
      return {
        item: s.item,
        affinity,
        composite:
          (s.count / maxCount) * 0.25
          + (Math.min(s.item.rating ?? 0, 10) / 10) * 0.3
          + (Math.min(Math.max((s.item.year ?? 2000) - 2000, 0), 30) / 30) * 0.25
          + Math.max(-1, Math.min(1, taste)) * 0.2,
      };
    })
    .sort((a, b) => {
      // A ≥95% match is decisive — it wins outright over TMDb's own
      // ranking, highest affinity first among qualifiers. Below that,
      // affinity has already been folded nowhere else here (unlike
      // recommendationScore.ts, this row has no per-item "reason" text to
      // layer a softer bonus onto) — the existing composite score decides,
      // unchanged from before this middleware existed.
      const aQualifies = a.affinity >= GENRE_AFFINITY_PROMOTE_THRESHOLD;
      const bQualifies = b.affinity >= GENRE_AFFINITY_PROMOTE_THRESHOLD;
      if (aQualifies !== bQualifies) return aQualifies ? -1 : 1;
      if (aQualifies) return b.affinity - a.affinity;
      return b.composite - a.composite;
    })
    .slice(0, 200)
    .map((s) => s.item);

  return filterSuggestable(ranked);
}
