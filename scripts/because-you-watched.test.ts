import { test } from "node:test";
import assert from "node:assert/strict";
import { setWatchedEpisodes, setWatchedMovies, recordWatched } from "@/lib/plex/watchStore";
import { setRating } from "@/lib/ai/tasteProfile";
import { pickAnchor } from "@/lib/recommender/becauseYouWatched";

// Real fs-backed stores, throwaway per-test userIds — same convention as
// scripts/recommendation-score.test.ts's direct use of recordFeedback().
let counter = 0;
function freshUserId(): string {
  counter += 1;
  return `test-because-${Date.now()}-${counter}`;
}

test("pickAnchor (series) : la série avec le plus d'épisodes vus gagne", () => {
  const userId = freshUserId();
  setWatchedEpisodes(userId, [{ tmdbId: 1001, season: 1, episode: 1 }], true, "Série A");
  setWatchedEpisodes(userId, [
    { tmdbId: 1002, season: 1, episode: 1 },
    { tmdbId: 1002, season: 1, episode: 2 },
    { tmdbId: 1002, season: 1, episode: 3 },
  ], true, "Série B");

  const anchor = pickAnchor(userId, "series");
  assert.equal(anchor?.tmdbId, 1002);
  assert.equal(anchor?.title, "Série B");
  assert.equal(anchor?.verb, "watched");
});

test("pickAnchor (series) : égalité départagée par l'entrée la plus récente, résultat stable rejoué deux fois", () => {
  const userId = freshUserId();
  const now = Date.now();
  setWatchedEpisodes(userId, [{ tmdbId: 2001, season: 1, episode: 1 }], true, "Ancienne série");
  setWatchedEpisodes(userId, [{ tmdbId: 2002, season: 1, episode: 1 }], true, "Série récente");
  // Force un ordre de récence explicite (setWatchedEpisodes utilise Date.now()
  // en interne, insuffisant pour un départage déterministe dans un test).
  recordWatched(userId, { tmdbId: 2001, type: "series", title: "Ancienne série", at: now - 10_000 });
  recordWatched(userId, { tmdbId: 2002, type: "series", title: "Série récente", at: now });

  assert.equal(pickAnchor(userId, "series")?.tmdbId, 2002);
  assert.equal(pickAnchor(userId, "series")?.tmdbId, 2002);
});

test("pickAnchor (movie) : une note explicite >=4 gagne même sur un film vu plus récemment sans note", () => {
  const userId = freshUserId();
  setWatchedMovies(userId, [3002], true, "Vu récemment, non noté");
  setRating(userId, { tmdbId: 3001, type: "movie", title: "Noté 5 étoiles", rating: 5, source: "explicit", confidence: 1 });

  const anchor = pickAnchor(userId, "movie");
  assert.equal(anchor?.tmdbId, 3001);
  assert.equal(anchor?.verb, "liked");
});

test("pickAnchor (movie) : une note 'inferred' ne produit JAMAIS verb:liked, retombe sur le repli visionnage", () => {
  const userId = freshUserId();
  setWatchedMovies(userId, [4001], true, "Seul film vu");
  setRating(userId, { tmdbId: 4001, type: "movie", title: "Seul film vu", rating: 5, source: "inferred", confidence: 0.8 });

  const anchor = pickAnchor(userId, "movie");
  assert.equal(anchor?.tmdbId, 4001);
  assert.equal(anchor?.verb, "watched");
});

test("pickAnchor (movie) : sans note, le film le plus récemment regardé gagne", () => {
  const userId = freshUserId();
  const now = Date.now();
  setWatchedMovies(userId, [5001], true, "Ancien");
  setWatchedMovies(userId, [5002], true, "Récent");
  recordWatched(userId, { tmdbId: 5001, type: "movie", title: "Ancien", at: now - 10_000 });
  recordWatched(userId, { tmdbId: 5002, type: "movie", title: "Récent", at: now });

  const anchor = pickAnchor(userId, "movie");
  assert.equal(anchor?.tmdbId, 5002);
  assert.equal(anchor?.verb, "watched");
});

test("pickAnchor : aucun historique ni note (utilisateur neuf) -> null pour movie ET series", () => {
  const userId = freshUserId();
  assert.equal(pickAnchor(userId, "movie"), null);
  assert.equal(pickAnchor(userId, "series"), null);
});

test("pickAnchor (series) : un seul épisode d'une seule série reste un signal exploitable (jamais un minimum imposé)", () => {
  const userId = freshUserId();
  setWatchedEpisodes(userId, [{ tmdbId: 6001, season: 1, episode: 1 }], true, "Un seul épisode");

  const anchor = pickAnchor(userId, "series");
  assert.equal(anchor?.tmdbId, 6001);
});

test("pickAnchor : userId vide -> null sans toucher aux stores", () => {
  assert.equal(pickAnchor("", "movie"), null);
  assert.equal(pickAnchor("", "series"), null);
});
