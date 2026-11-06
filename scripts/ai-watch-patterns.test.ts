import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-watch-patterns-"));
const { recordUserContextEvent } = await import("../src/lib/userContext/ingest.ts");
const { computeWatchPatterns, formatWatchPatterns, formatDroppedSeries, countViewings } = await import("../src/lib/ai/watchPatterns.ts");
const store = await import("../src/lib/library/store.ts");

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
let seq = 0;
function completed(userId: string, tmdbId: number, mediaType: "movie" | "episode", at: number, title: string, season?: number, episode?: number) {
  recordUserContextEvent({
    userId, eventType: mediaType === "movie" ? "movie_completed" : "episode_completed", source: "test", tmdbId, mediaType,
    seasonNumber: season ?? null, episodeNumber: episode ?? null, title, occurredAt: at, sourceEventId: `t${seq++}`,
  });
}

test("deux enregistrements du même passage à quelques minutes d'écart ne font qu'un visionnage ; deux jours différents, deux", () => {
  assert.equal(countViewings([NOW, NOW + 3 * 60_000]).viewings, 1);
  assert.equal(countViewings([NOW, NOW + 13 * HOUR]).viewings, 2);
  assert.equal(countViewings([NOW, NOW + 2 * HOUR, NOW + 30 * DAY]).viewings, 2);
});

test("un film revu et une série vue en entier puis revue sont repérés, un film vu une fois non", () => {
  const user = "u_rewatch";
  // Film vu deux fois à un mois d'écart, un autre une seule fois (avec un doublon de la même séance).
  completed(user, 100, "movie", NOW - 40 * DAY, "Film culte");
  completed(user, 100, "movie", NOW - 8 * DAY, "Film culte");
  completed(user, 200, "movie", NOW - 20 * DAY, "Film unique");
  completed(user, 200, "movie", NOW - 20 * DAY + 2 * 60_000, "Film unique");

  // Série de 4 épisodes diffusés, tous vus, 2 revus.
  store.addSeries({
    id: "sr_rm", tmdbId: 300, imdbId: null, title: "Rick et Morty", year: 2013, releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
    genres: [], tvStatus: "Returning Series", monitored: true, qualityProfileId: "any", addedAt: 1,
    seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [1, 2, 3, 4].map((n) => ({ seasonNumber: 1, episodeNumber: n, title: `Ep ${n}`, airDate: "2014-01-01", monitored: true, status: "available", file: null, activeInfoHash: null, plexRatingKey: null })) }],
  } as never);
  for (let n = 1; n <= 4; n++) completed(user, 300, "episode", NOW - 300 * DAY + n * DAY, "Rick et Morty", 1, n);
  completed(user, 300, "episode", NOW - 5 * DAY, "Rick et Morty", 1, 1);
  completed(user, 300, "episode", NOW - 4 * DAY, "Rick et Morty", 1, 2);

  const patterns = computeWatchPatterns(user, NOW);
  assert.deepEqual(patterns.rewatchedMovies.map((m) => [m.title, m.viewings]), [["Film culte", 2]]);
  assert.equal(patterns.rewatchedSeries.length, 1);
  const rm = patterns.rewatchedSeries[0];
  assert.equal(rm.title, "Rick et Morty");
  assert.equal(rm.episodesSeen, 4);
  assert.equal(rm.episodesRewatched, 2);
  assert.equal(rm.fullySeen, true);

  const lines = formatWatchPatterns(patterns).join(" | ");
  assert.match(lines, /Rick et Morty \(série, vue en entier\) : REVUE — 2 épisode\(s\) revu\(s\) sur 4\/4 épisodes vus/);
  assert.match(lines, /Film culte \(film\) : REVU — 2 visionnages/);
  assert.doesNotMatch(lines, /Film unique/);
});

test("une série entamée puis laissée depuis longtemps est signalée avec la précaution d'usage ; un autre utilisateur n'est jamais mélangé", () => {
  completed("u_drop", 400, "episode", NOW - 200 * DAY, "Série laissée", 1, 1);
  const patterns = computeWatchPatterns("u_drop", NOW);
  assert.deepEqual(patterns.rewatchedSeries, []);
  assert.deepEqual(formatDroppedSeries(patterns, NOW), ["Série laissée : 1 épisode(s) vu(s) dans Movviz, plus rien depuis 200 jours"]);
  assert.deepEqual(computeWatchPatterns("u_inconnu", NOW), { rewatchedMovies: [], rewatchedSeries: [], dropped: [] });
});
