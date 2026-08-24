import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import type { MetaSearchResult } from "@/lib/metadata/types";

function item(overrides: Partial<MetaSearchResult>): MetaSearchResult {
  return {
    tmdbId: 1,
    type: "movie",
    title: "Test",
    year: 2024,
    releaseDate: "2020-01-01",
    overview: "",
    posterPath: null,
    backdropPath: null,
    rating: 7.5,
    ...overrides,
  };
}

test("filterSuggestable : rejette un titre à note 0", () => {
  const out = filterSuggestable([item({ tmdbId: 1, rating: 0 })]);
  assert.equal(out.length, 0);
});

test("filterSuggestable : rejette une date de sortie future", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  const out = filterSuggestable([item({ tmdbId: 1, releaseDate: future })]);
  assert.equal(out.length, 0);
});

test("filterSuggestable : garde un titre noté et déjà sorti", () => {
  const out = filterSuggestable([item({ tmdbId: 1, rating: 7.5, releaseDate: "2020-01-01" })]);
  assert.equal(out.length, 1);
});

test("filterSuggestable : une date nulle (série sans date connue) n'est pas rejetée sur ce critère seul", () => {
  const out = filterSuggestable([item({ tmdbId: 1, rating: 6, releaseDate: null })]);
  assert.equal(out.length, 1);
});

test("filterSuggestable : ne modifie pas les entrées conservées, ne filtre que celles rejetées", () => {
  const keep = item({ tmdbId: 1, rating: 8 });
  const reject = item({ tmdbId: 2, rating: 0 });
  const out = filterSuggestable([keep, reject]);
  assert.deepEqual(out, [keep]);
});
