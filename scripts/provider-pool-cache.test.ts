import test from "node:test";
import assert from "node:assert/strict";
import { providerPoolIsCacheable } from "@/lib/recommender/providerPersonalized";

test("an empty provider catalog response is never cached", () => {
  assert.equal(providerPoolIsCacheable({ results: [] }), false);
});

test("a populated Netflix provider pool remains cacheable", () => {
  assert.equal(providerPoolIsCacheable({ results: [{ tmdbId: 1 }] as never[] }), true);
});
