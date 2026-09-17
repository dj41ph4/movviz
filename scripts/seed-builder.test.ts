import { test } from "node:test";
import assert from "node:assert/strict";
import { setWatchedMovies, setWatchedEpisodes, recordWatched } from "@/lib/plex/watchStore";
import { setRating } from "@/lib/ai/tasteProfile";
import { recordFeedback } from "@/lib/ai/tasteProfile";
import { buildSeeds } from "@/lib/recommender/seedBuilder";

let counter = 0;
function freshUserId(): string {
  counter += 1;
  return `test-seedbuilder-${Date.now()}-${counter}`;
}

test("Cas A : un film noté 5★ pèse plus lourd comme seed qu'un film juste vu", () => {
  const userId = freshUserId();
  setWatchedMovies(userId, [101, 102], true, "vus");
  setRating(userId, { tmdbId: 102, type: "movie", title: "Adoré", rating: 5, source: "explicit", confidence: 1 });

  const seeds = buildSeeds(userId, "movie");
  const a = seeds.find((s) => s.tmdbId === 101);
  const b = seeds.find((s) => s.tmdbId === 102);
  assert.ok(a && b, "les deux titres doivent être des seeds");
  assert.ok(b!.weight > a!.weight, "le film noté 5★ doit peser plus que le film juste vu");
});

test("Cas B : un film noté 1★ n'est jamais un seed positif", () => {
  const userId = freshUserId();
  setWatchedMovies(userId, [201], true, "détesté");
  setRating(userId, { tmdbId: 201, type: "movie", title: "Détesté", rating: 1, source: "explicit", confidence: 1 });

  const seeds = buildSeeds(userId, "movie");
  assert.equal(seeds.find((s) => s.tmdbId === 201), undefined);
});

test("un 👎 explicite exclut aussi le titre comme seed", () => {
  const userId = freshUserId();
  setWatchedMovies(userId, [301], true, "mauvaise reco");
  recordFeedback(userId, { tmdbId: 301, type: "movie", title: "Mauvaise reco", liked: false, at: Date.now() });

  const seeds = buildSeeds(userId, "movie");
  assert.equal(seeds.find((s) => s.tmdbId === 301), undefined);
});

test("Cas C : une série avec plus d'épisodes vus pèse plus qu'une série à peine commencée", () => {
  const userId = freshUserId();
  setWatchedEpisodes(userId, [{ tmdbId: 401, season: 1, episode: 1 }], true, "à peine commencée");
  setWatchedEpisodes(userId, [
    { tmdbId: 402, season: 1, episode: 1 },
    { tmdbId: 402, season: 1, episode: 2 },
    { tmdbId: 402, season: 1, episode: 3 },
    { tmdbId: 402, season: 1, episode: 4 },
    { tmdbId: 402, season: 1, episode: 5 },
  ], true, "suivie assidûment");

  const seeds = buildSeeds(userId, "series");
  const light = seeds.find((s) => s.tmdbId === 401);
  const heavy = seeds.find((s) => s.tmdbId === 402);
  assert.ok(light && heavy);
  assert.ok(heavy!.weight > light!.weight);
  assert.ok(heavy!.reasons.includes("series_engagement"));
});

test("aucun historique -> aucun seed", () => {
  const userId = freshUserId();
  assert.deepEqual(buildSeeds(userId, "movie"), []);
});

test("les poids restent bornés entre 0 et 1 même avec tous les bonus cumulés", () => {
  const userId = freshUserId();
  const now = Date.now();
  setWatchedMovies(userId, [501], true, "combo");
  recordWatched(userId, { tmdbId: 501, type: "movie", title: "combo", at: now });
  setRating(userId, { tmdbId: 501, type: "movie", title: "combo", rating: 5, source: "explicit", confidence: 1 });
  recordFeedback(userId, { tmdbId: 501, type: "movie", title: "combo", liked: true, at: now });

  const seeds = buildSeeds(userId, "movie");
  const seed = seeds.find((s) => s.tmdbId === 501);
  assert.ok(seed);
  assert.ok(seed!.weight <= 1);
});
