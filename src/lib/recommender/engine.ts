import { getGenres, getPerson, getTasteMetadata as getDetail } from "@/lib/metadata/tmdb";
import { getWatchedTitles } from "@/lib/recommender/watchedTitles";
import { diversifyBySeed } from "@/lib/recommender/diversify";
import { mapWithConcurrency } from "@/lib/concurrency";
import { buildTasteVector } from "@/lib/ai/contrastiveProfile";
import { getCachedMoodProfile, moodSimilarity } from "@/lib/ai/titleAnalysis";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { getComputedGenreTraits, getFavoriteKeywords, matchGenreAffinity, matchKeywordAffinity, getFavoritePeople } from "@/lib/userContext/taste";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { audienceSignal } from "@/lib/recommender/audienceSignal";
import { buildSeeds } from "@/lib/recommender/seedBuilder";
import { aggregateCandidateEvidence, type CandidateEvidence, type RelationSource } from "@/lib/recommender/evidence";
import { scoreCandidate } from "@/lib/recommender/scorer";
import { readHistoryRelations, historyRelations } from "./historyRelations";

// Strictly per-account: this row is built ONLY from the target account's own
// Plex watch history — never blended with what any other account has
// watched, even a single other title. Two accounts on the same instance must
// never influence each other's "for you" row. Confirmed explicitly with the
// user after an earlier attempt at cross-account blending — even a single
// watched title of one's own is used as a real (if narrow) personal seed
// rather than falling back to a generic list once there's at least one.
/** Titres vus de l'autre type traduits en registre (films ↔ séries). */

async function buildRecommendations(
  userId: string,
  type: "movie" | "series"
): Promise<MetaSearchResult[]> {
  // Titres marqués vus + historique de lecture (watchedTitles.ts) : un film
  // déjà lancé ne revient jamais en suggestion.
  const watched: number[] = [...getWatchedTitles(userId, type).keys()];

  // Titres vus de l'AUTRE type : leurs registres (genres + langue) nourrissent
  // aussi cette rangée — voir crossType.ts. Quelqu'un qui ne regarde que des
  // séries reçoit donc aussi des films choisis à partir de ses séries.
  const crossType = type === "movie" ? "series" : "movie";
  const crossSeeds = buildSeeds(userId, crossType);

  if (watched.length === 0 && crossSeeds.length === 0) return [];

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

  // Posséder un titre ne veut pas dire l'avoir vu : le retirer empêchait un
  // titre déjà en bibliothèque mais jamais regardé — souvent exactement ce
  // qu'on a envie de voir ensuite, confirmé en direct — d'apparaître ici,
  // alors que "Titres similaires" sur une fiche (même moteur, par titre) ne
  // filtre jamais la bibliothèque et le montre. Seul "déjà vu" doit exclure.
  const excluded = new Set<number>([...watched, ...dislikedTmdbIds]);

  // Un titre juste vu ne pèse plus pareil qu'un titre adoré/noté 5★/revu :
  // buildSeeds() qualifie chaque seed par force de signal (note explicite,
  // 👍, engagement série, récence) au lieu de traiter "vu" comme un
  // indicateur binaire (audit Phase 1, §4.2/§17 du plan de refonte).
  const seeds = buildSeeds(userId, type);
  if (seeds.length === 0 && crossSeeds.length === 0) return [];

  // TMDb's TV /recommendations dataset (derived from OTHER users' viewing
  // overlap) is noticeably sparser than movies' — confirmed live: this row
  // ran out of replacements after a couple of 👎 for séries, while films
  // never did, even though the same dislike-exclusion (above) applies
  // equally to both. /similar is content-based (genres/keywords) rather
  // than behavior-based, so it has real signal even for a title
  // /recommendations barely covers, and is a legitimate SECOND vote toward
  // the same candidate — merged into the same evidence pool below (with a
  // slightly lower per-source weight, see evidence.ts) rather than kept
  // fully separate, so a title both engines agree on still ranks higher
  // than one only one of them suggested.
  const [ownHits, crossHits] = await Promise.all([
    readHistoryRelations(type, seeds, userId), readHistoryRelations(crossType, crossSeeds, userId),
  ]);

  const hits: Array<{ item: MetaSearchResult; source: RelationSource }> = [];
  for (const kind of ["tmdb_recommendation", "tmdb_similar"] as const) {
    for (const entry of ownHits) {
      const items = kind === "tmdb_recommendation" ? entry.relations.recommendations : entry.relations.similar;
      items.forEach((item, sourceRank) => {
        if (excluded.has(item.tmdbId)) return;
        hits.push({ item, source: { kind, seedTmdbId: entry.seed.tmdbId, seedWeight: entry.seed.weight, sourceRank } });
      });
    }
  }
  for (const entry of crossHits) {
    entry.relations.bridge.forEach((item, sourceRank) => {
      if (excluded.has(item.tmdbId)) return;
      // Identifiant négatif : un film et une série peuvent partager le même
      // tmdbId, et deux titres vus distincts doivent compter comme deux voix.
      hits.push({ item, source: { kind: "cross_type_genre", seedTmdbId: -entry.seed.tmdbId, seedWeight: entry.seed.weight, sourceRank } });
    });
  }

  const evidenceById = aggregateCandidateEvidence(hits);

  // Favorite people refine the history-related pool, without injecting an
  // independent filmography into personalized suggestions.
  const favoritePeople = await withinBudget(getFavoritePeople(userId, 3), []);
  const personAffinity = new Map<number, number>();
  if (favoritePeople.length) {
    const people = await withinBudget(mapWithConcurrency(favoritePeople, 3, async (person) => {
      try { return { person, detail: await getPerson(person.id) }; } catch { return null; }
    }), []);
    for (const entry of people) {
      if (!entry?.detail) continue;
      const { person, detail } = entry;
      const strength = person.strength * person.confidence;
      for (const credit of detail.credits) {
        if (credit.type !== type) continue;
        if (person.role === "cast" && !credit.isCast) continue;
        if (person.role === "director" && !credit.isDirector) continue;
        if (excluded.has(credit.tmdbId)) continue;
        if (!evidenceById.has(credit.tmdbId)) {
          continue; // People refine the shared history pool, never inject an unrelated catalogue.
        }
        const prior = personAffinity.get(credit.tmdbId) ?? 0;
        if (strength > prior) personAffinity.set(credit.tmdbId, strength);
      }
    }
  }

  const entries = [...evidenceById.values()];

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
    ? new Map((await withinBudget(getGenres(type), [])).map((g) => [g.id, g.name] as const))
    : new Map<number, string>();
  const favoriteKeywords = await withinBudget(getFavoriteKeywords(userId), new Map<string, number>());
  const keywordDetails = new Map<number, string[]>();
  // Only the titles that can realistically reach the visible rail need a
  // detail request for keyword scoring. Going fifty deep multiplied every
  // dashboard refresh into dozens of extra TMDb connections.
  const detailCandidates = [...entries]
    .sort((a, b) => audienceSignal(b.item) - audienceSignal(a.item) || b.distinctSeedCount - a.distinctSeedCount)
    .slice(0, 20);
  await withinBudget(mapWithConcurrency(detailCandidates, 4, async ({ item }) => {
    const detail = await getDetail(type, item.tmdbId).catch(() => null);
    if (detail) keywordDetails.set(item.tmdbId, detail.keywords);
  }), []);

  const ranked = entries
    .map((evidence: CandidateEvidence) => {
      let taste = 0;
      if (tasteVector) {
        const candidateMood = getCachedMoodProfile(type, evidence.item.tmdbId)?.categories;
        if (candidateMood) {
          taste = (moodSimilarity(tasteVector.liked, candidateMood) - moodSimilarity(tasteVector.disliked, candidateMood)) * tasteVector.confidence;
        }
      }
      const genreNames = genreNameById.size
        ? (evidence.item.genreIds ?? []).map((id) => genreNameById.get(id)).filter((n): n is string => !!n)
        : [];
      const genreAffinity = genreNames.length ? matchGenreAffinity(genreNames, genreTraits) : 0;
      const keywordAffinity = matchKeywordAffinity(keywordDetails.get(evidence.item.tmdbId) ?? [], favoriteKeywords);
      const personAffinityScore = personAffinity.get(evidence.item.tmdbId) ?? 0;

      const { score } = scoreCandidate({
        evidence,
        tasteVector: taste,
        genreAffinity,
        keywordAffinity,
        personAffinity: personAffinityScore,
      });

      return { item: evidence.item, score, evidence };
    })
    // No single broad signal can force the first place: relation to seeds,
    // multi-seed consensus, people, genres, themes, behavior, rating and
    // public traction all contribute (see scorer.ts for exact weights).
    .sort((a, b) => b.score - a.score);

  // Then no single watched title may fill the row on its own (diversify.ts).
  return filterSuggestable(diversifyBySeed(ranked).map((s) => s.item));
}

const globals = globalThis as typeof globalThis & {
  __movvizRecommendationPools?: Map<string, { signature: string; at: number; inFlight: boolean; promise: Promise<MetaSearchResult[]> }>;
};
async function withinBudget<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work.catch(() => fallback), new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), 1200);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
/** One per-profile ranking reused by desktop/mobile/TV and provider rails.
 * Public title relations are shared, never another profile's watched list. */
export async function getRecommendationPool(userId: string, type: "movie" | "series"): Promise<MetaSearchResult[]> {
  const cache = globals.__movvizRecommendationPools ??= new Map();
  const key = `${userId}:${type}`;
  const signature = JSON.stringify([buildSeeds(userId, "movie"), buildSeeds(userId, "series"), getFeedback(userId), historyRelations.generation]);
  let entry = cache.get(key);
  if (!entry || (!entry.inFlight && (entry.signature !== signature || Date.now() - entry.at > 30_000))) {
    entry = { signature, at: Date.now(), inFlight: true, promise: buildRecommendations(userId, type) };
    cache.set(key, entry);
    const created = entry;
    entry.promise.finally(() => { created.inFlight = false; }).catch(() => {});
    entry.promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  }
  const results: MetaSearchResult[] = await entry.promise;
  // A watched/rejected decision made during a fetch wins immediately.
  const excluded = new Set([...getWatchedTitles(userId, type).keys(),
    ...getFeedback(userId).filter((f) => !f.liked && f.type === type).map((f) => f.tmdbId)]);
  return results.filter((item) => !excluded.has(item.tmdbId));
}

export async function getRecommendations(userId: string, type: "movie" | "series"): Promise<MetaSearchResult[]> {
  // Presentation limit only; provider filtering and pagination use the FULL pool.
  return (await getRecommendationPool(userId, type)).slice(0, 200);
}

export function recommendationsPending(userId: string): boolean {
  return (["movie", "series"] as const).some((type) =>
    historyRelations.hasPending(buildSeeds(userId, type).map((seed) => `${type}:${seed.tmdbId}`)));
}
