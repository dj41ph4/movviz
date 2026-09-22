import { getMovieRecommendations, getTvRecommendations, getMovieSimilar, getTvSimilar, getGenres, getPerson, getDetail } from "@/lib/metadata/tmdb";
import { getWatchStatus } from "@/lib/plex/watchStore";
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
  if (seeds.length === 0) return [];

  const fetchFn = type === "movie" ? getMovieRecommendations : getTvRecommendations;
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
  const similarFn = type === "movie" ? getMovieSimilar : getTvSimilar;
  const [recommendationHits, similarHits] = await Promise.all([
    mapWithConcurrency(seeds, 5, async (seed) => {
      try { return { seed, page: await fetchFn(seed.tmdbId) }; } catch { return null; }
    }),
    mapWithConcurrency(seeds, 5, async (seed) => {
      try { return { seed, page: await similarFn(seed.tmdbId) }; } catch { return null; }
    }),
  ]);

  const hits: Array<{ item: MetaSearchResult; source: RelationSource }> = [];
  for (const kind of ["tmdb_recommendation", "tmdb_similar"] as const) {
    const pages = kind === "tmdb_recommendation" ? recommendationHits : similarHits;
    for (const entry of pages) {
      if (!entry?.page) continue;
      entry.page.results.forEach((item, sourceRank) => {
        if (excluded.has(item.tmdbId)) return;
        hits.push({ item, source: { kind, seedTmdbId: entry.seed.tmdbId, seedWeight: entry.seed.weight, sourceRank } });
      });
    }
  }

  const evidenceById = aggregateCandidateEvidence(hits);

  // "j'adore Jim Carrey" / plusieurs films avec le même acteur regardés =
  // c'est ça les suggestions : le reste de la filmographie d'un acteur ou
  // réalisateur favori (userContext/taste.ts — étoiles, pouces, ET simple
  // récurrence de visionnage, pas seulement le chat IA) doit apparaître ICI,
  // pas juste dans les réponses du chat. TMDb /recommendations et /similar
  // ne suffisent pas : ils sont basés sur "les autres spectateurs de ce
  // titre ont aussi aimé", pas sur "cet acteur précis". On va donc chercher
  // sa filmographie complète via getPerson() et on l'injecte dans le même
  // pool de candidats (comme une évidence à part, sans relation de seed —
  // le terme "people" du scorer porte ce signal, pas relation/consensus).
  const favoritePeople = await getFavoritePeople(userId, 3);
  const personAffinity = new Map<number, number>();
  if (favoritePeople.length) {
    const people = await mapWithConcurrency(favoritePeople, 3, async (person) => {
      try { return { person, detail: await getPerson(person.id) }; } catch { return null; }
    });
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
          evidenceById.set(credit.tmdbId, { item: credit, sources: [], distinctSeedCount: 0 });
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
    ? new Map((await getGenres(type)).map((g) => [g.id, g.name] as const))
    : new Map<number, string>();
  const favoriteKeywords = await getFavoriteKeywords(userId);
  const keywordDetails = new Map<number, string[]>();
  // Only the titles that can realistically reach the visible rail need a
  // detail request for keyword scoring. Going fifty deep multiplied every
  // dashboard refresh into dozens of extra TMDb connections.
  const detailCandidates = [...entries]
    .sort((a, b) => audienceSignal(b.item) - audienceSignal(a.item) || b.distinctSeedCount - a.distinctSeedCount)
    .slice(0, 20);
  await mapWithConcurrency(detailCandidates, 4, async ({ item }) => {
    const detail = await getDetail(type, item.tmdbId).catch(() => null);
    if (detail) keywordDetails.set(item.tmdbId, detail.keywords);
  });

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

      return { item: evidence.item, score };
    })
    // No single broad signal can force the first place: relation to seeds,
    // multi-seed consensus, people, genres, themes, behavior, rating and
    // public traction all contribute (see scorer.ts for exact weights).
    .sort((a, b) => b.score - a.score)
    .slice(0, 200)
    .map((s) => s.item);

  return filterSuggestable(ranked);
}
