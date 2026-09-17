import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateCandidateEvidence, type RelationSource } from "@/lib/recommender/evidence";
import { scoreCandidate } from "@/lib/recommender/scorer";
import type { MetaSearchResult } from "@/lib/metadata/types";

function item(tmdbId: number, overrides: Partial<MetaSearchResult> = {}): MetaSearchResult {
  return {
    tmdbId,
    type: "movie",
    title: `Titre ${tmdbId}`,
    year: 2020,
    releaseDate: "2020-01-01",
    overview: "",
    posterPath: null,
    backdropPath: null,
    rating: 6,
    ...overrides,
  } as MetaSearchResult;
}

function relation(seedTmdbId: number, seedWeight: number, sourceRank = 0, kind: RelationSource["kind"] = "tmdb_recommendation"): RelationSource {
  return { kind, seedTmdbId, seedWeight, sourceRank };
}

test("Test §40 : consensus multi-seed bat un candidat porté par un seul seed, à qualité publique égale", () => {
  const consensus = aggregateCandidateEvidence([
    { item: item(1), source: relation(11, 0.95, 2) },
    { item: item(1), source: relation(12, 0.9, 3) },
    { item: item(1), source: relation(13, 0.8, 5) },
  ]).get(1)!;
  const single = aggregateCandidateEvidence([
    { item: item(2), source: relation(11, 0.95, 2) },
  ]).get(2)!;

  const scoredConsensus = scoreCandidate({ evidence: consensus, tasteVector: 0, genreAffinity: 0, keywordAffinity: 0, personAffinity: 0 });
  const scoredSingle = scoreCandidate({ evidence: single, tasteVector: 0, genreAffinity: 0, keywordAffinity: 0, personAffinity: 0 });

  assert.ok(scoredConsensus.score > scoredSingle.score);
  assert.ok(scoredConsensus.reasonCodes.includes("MULTI_SEED_MATCH"));
});

test("Test §41 : la popularité seule ne doit pas battre une forte relation à plusieurs seeds", () => {
  const relatedToTaste = aggregateCandidateEvidence([
    { item: item(3, { rating: 6.5 }), source: relation(11, 0.9, 1) },
    { item: item(3, { rating: 6.5 }), source: relation(12, 0.85, 1) },
    { item: item(3, { rating: 6.5 }), source: relation(13, 0.8, 1) },
  ]).get(3)!;
  const ultraPopularNoRelation: import("@/lib/recommender/evidence").CandidateEvidence = {
    item: item(4, { rating: 8.5, popularity: 500, voteCount: 20000 } as Partial<MetaSearchResult>),
    sources: [],
    distinctSeedCount: 0,
  };

  const scoredRelated = scoreCandidate({ evidence: relatedToTaste, tasteVector: 0, genreAffinity: 0, keywordAffinity: 0, personAffinity: 0 });
  const scoredPopular = scoreCandidate({ evidence: ultraPopularNoRelation, tasteVector: 0, genreAffinity: 0, keywordAffinity: 0, personAffinity: 0 });

  assert.ok(scoredRelated.score > scoredPopular.score, `related=${scoredRelated.score} popular=${scoredPopular.score}`);
});

test("un candidat sans aucune évidence (favori de personne uniquement) reste scorable", () => {
  const evidence: import("@/lib/recommender/evidence").CandidateEvidence = {
    item: item(5),
    sources: [],
    distinctSeedCount: 0,
  };
  const scored = scoreCandidate({ evidence, tasteVector: 0, genreAffinity: 0, keywordAffinity: 0, personAffinity: 0.9 });
  assert.ok(scored.score > 0);
  assert.ok(scored.reasonCodes.includes("FAVORITE_PERSON"));
});

test("le score est déterministe : mêmes entrées -> même sortie", () => {
  const evidence = aggregateCandidateEvidence([{ item: item(6), source: relation(11, 0.7, 4) }]).get(6)!;
  const input = { evidence, tasteVector: 0.3, genreAffinity: 0.5, keywordAffinity: 0.2, personAffinity: 0 };
  const a = scoreCandidate(input);
  const b = scoreCandidate(input);
  assert.deepEqual(a, b);
});

test("aggregateCandidateEvidence fusionne les occurrences d'un même titre en une seule entrée avec plusieurs sources", () => {
  const byId = aggregateCandidateEvidence([
    { item: item(7), source: relation(11, 0.9, 0) },
    { item: item(7), source: relation(11, 0.9, 0, "tmdb_similar") },
    { item: item(7), source: relation(12, 0.8, 1) },
  ]);
  assert.equal(byId.size, 1);
  const evidence = byId.get(7)!;
  assert.equal(evidence.sources.length, 3);
  assert.equal(evidence.distinctSeedCount, 2);
});
