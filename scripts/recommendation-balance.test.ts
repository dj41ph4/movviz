import { test } from "node:test";
import assert from "node:assert/strict";
import { diversifyBySeed } from "@/lib/recommender/diversify";
import { crossTypeBridgeFilters } from "@/lib/recommender/crossType";
import type { CandidateEvidence, RelationSource } from "@/lib/recommender/evidence";

/**
 * « Sélection pour vous » : tout ce qui a été vu doit compter, pas le seul
 * titre vu le plus fort (constaté : 9 des 20 films venaient de « 300 »).
 */

function candidate(tmdbId: number, score: number, seeds: Array<{ seed: number; weight?: number; rank?: number }>) {
  const sources: RelationSource[] = seeds.map(({ seed, weight = 0.3, rank = 0 }) => ({ kind: "tmdb_recommendation", seedTmdbId: seed, seedWeight: weight, sourceRank: rank }));
  const evidence: CandidateEvidence = {
    item: { tmdbId, type: "movie", title: `T${tmdbId}`, year: 2000, posterPath: null, rating: 7 } as CandidateEvidence["item"],
    sources,
    distinctSeedCount: new Set(seeds.map((s) => s.seed)).size,
  };
  return { score, evidence };
}

test("un titre vu fort ne remplit plus le début de la rangée à lui seul", () => {
  // « 300 » (seed 1, poids fort) : 12 candidats très bien notés ; trois
  // autres titres vus (2, 3, 4) : 4 candidats chacun, un peu moins bien notés.
  const list = [
    ...Array.from({ length: 12 }, (_, i) => candidate(100 + i, 0.5 - i * 0.002, [{ seed: 1, weight: 0.9, rank: i }])),
    ...[2, 3, 4].flatMap((seed) => Array.from({ length: 4 }, (_, i) => candidate(seed * 1000 + i, 0.4 - i * 0.002, [{ seed, rank: i }]))),
  ].sort((a, b) => b.score - a.score);
  const before = list.slice(0, 10).filter((c) => c.evidence.sources[0].seedTmdbId === 1).length;
  const top10 = diversifyBySeed(list).slice(0, 10);
  const from300 = top10.filter((c) => c.evidence.sources[0].seedTmdbId === 1).length;
  assert.equal(before, 10);
  assert.ok(from300 <= 4, `${from300} suggestions sur 10 viennent encore du même titre vu`);
  for (const seed of [2, 3, 4]) assert.ok(top10.some((c) => c.evidence.sources[0].seedTmdbId === seed), `le titre vu ${seed} doit être représenté`);
});

test("un titre soutenu par plusieurs titres vus reste en tête", () => {
  const consensus = candidate(1, 0.6, [{ seed: 1 }, { seed: 2 }, { seed: 3 }]);
  const list = [consensus, ...Array.from({ length: 8 }, (_, i) => candidate(10 + i, 0.55 - i * 0.01, [{ seed: 1, rank: i }]))];
  assert.equal(diversifyBySeed(list)[0].evidence.item.tmdbId, 1);
});

test("aucun titre perdu, ordre inchangé quand un seul titre vu existe", () => {
  const list = Array.from({ length: 30 }, (_, i) => candidate(i, 1 - i * 0.01, [{ seed: 7, rank: i }]));
  const out = diversifyBySeed(list);
  assert.equal(out.length, 30);
  assert.deepEqual(out.map((c) => c.evidence.item.tmdbId), list.map((c) => c.evidence.item.tmdbId));
});

test("pont séries → films : anime japonais → films d'animation japonais", () => {
  assert.deepEqual(crossTypeBridgeFilters("series", { genreIds: [16, 10759], originalLanguage: "ja" }), { genre: "16,28", originalLanguage: "ja" });
});

test("pont séries → films : série policière → films policiers, sans filtre de langue anglaise", () => {
  assert.deepEqual(crossTypeBridgeFilters("series", { genreIds: [80, 18], originalLanguage: "en" }), { genre: "80,18" });
});

test("pont : un genre large seul en anglais ne suffit pas (« Drame » ramènerait n'importe quoi)", () => {
  assert.equal(crossTypeBridgeFilters("series", { genreIds: [18], originalLanguage: "en" }), null);
  assert.deepEqual(crossTypeBridgeFilters("series", { genreIds: [18], originalLanguage: "ko" }), { genre: "18", originalLanguage: "ko" });
});

test("pont films → séries : action/aventure et science-fiction fusionnés côté séries", () => {
  assert.deepEqual(crossTypeBridgeFilters("movie", { genreIds: [28, 12, 878], originalLanguage: "en" }), { genre: "10759,10765" });
});

test("filmographies de personnes favorites : un groupe limité comme les autres, plus d'invasion", () => {
  // Constaté en prod : quatre « John Wick » + apparitions TV d'un même acteur
  // remontaient en bloc, exemptées de la limite par titre vu.
  const people = Array.from({ length: 10 }, (_, i) => candidate(500 + i, 0.3 - i * 0.001, []));
  const seeded = [1, 2, 3].flatMap((seed) => Array.from({ length: 6 }, (_, i) => candidate(seed * 100 + i, 0.4 - i * 0.002, [{ seed, rank: i }])));
  const top12 = diversifyBySeed([...seeded, ...people].sort((a, b) => b.score - a.score)).slice(0, 12);
  const fromPeople = top12.filter((c) => c.evidence.sources.length === 0).length;
  assert.ok(fromPeople <= 3, `${fromPeople} titres sur 12 viennent d'une filmographie`);
});

test("pont : la langue ne cible que si elle définit un registre (pas le français, cf. « n'aime pas les films français »)", () => {
  assert.equal(crossTypeBridgeFilters("movie", { genreIds: [35], originalLanguage: "fr" }), null);
  assert.deepEqual(crossTypeBridgeFilters("movie", { genreIds: [35, 80], originalLanguage: "fr" }), { genre: "80,35" });
  assert.deepEqual(crossTypeBridgeFilters("series", { genreIds: [18], originalLanguage: "ko" }), { genre: "18", originalLanguage: "ko" });
});
