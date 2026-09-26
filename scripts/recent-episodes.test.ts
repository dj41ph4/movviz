import test from "node:test";
import assert from "node:assert/strict";
import { recentEpisodesAcrossSeries } from "../src/lib/library/recentEpisodes";

test("une saison entière arrivée d'un coup ne cache plus les autres ajouts récents", () => {
  const bulk = Array.from({ length: 40 }, (_, i) => ({ tmdbId: 1, addedAt: 1_000, episode: i + 1 }));
  const others = [2, 3, 4].map((tmdbId, i) => ({ tmdbId, addedAt: 900 - i, episode: 1 }));
  const list = recentEpisodesAcrossSeries([...others, ...bulk]);
  assert.deepEqual([...new Set(list.map((e) => e.tmdbId))], [1, 2, 3, 4]);
  assert.equal(list.filter((e) => e.tmdbId === 1).length, 40, "every episode of the bulk is still there");
});

test("la liste s'arrête au nombre de séries voulu et reste plafonnée", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ tmdbId: i, addedAt: 1_000 - i }));
  assert.equal(recentEpisodesAcrossSeries(many, 20).length, 20);
  const huge = Array.from({ length: 500 }, (_, i) => ({ tmdbId: 1, addedAt: i }));
  assert.equal(recentEpisodesAcrossSeries(huge, 20, 150).length, 150);
});
