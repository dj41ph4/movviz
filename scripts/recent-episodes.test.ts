import test from "node:test";
import assert from "node:assert/strict";
import { groupRecentEpisodes, recentEpisodePage, recentEpisodesAcrossSeries } from "../src/lib/library/recentEpisodes";
import type { DashboardLibrarySeries, DashboardRecentEpisode } from "../src/lib/dashboard/interfaceTypes";

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

test("les pages parcourent toutes les séries malgré un import massif", () => {
  const bulk = Array.from({ length: 500 }, (_, i) => ({ tmdbId: 1, seasonNumber: 1, addedAt: 10_000 - i }));
  const others = Array.from({ length: 45 }, (_, i) => ({ tmdbId: i + 2, seasonNumber: 1, addedAt: 9_000 - i }));
  const all = [...bulk, ...others];
  const first = recentEpisodePage(all);
  const second = recentEpisodePage(all, first.nextCursor!);
  const third = recentEpisodePage(all, second.nextCursor!);
  assert.equal(new Set(first.episodes.map((ep) => ep.tmdbId)).size, 20);
  assert.equal(first.episodes.filter((ep) => ep.tmdbId === 1).length, 2);
  assert.equal(second.nextCursor, 40);
  assert.equal(third.nextCursor, null);
  assert.equal(new Set([...first.episodes, ...second.episodes, ...third.episodes].map((ep) => ep.tmdbId)).size, 46);
});

const episode = (tmdbId: number, seasonNumber: number, episodeNumber: number, addedAt = episodeNumber): DashboardRecentEpisode => ({
  seriesId: `series-${tmdbId}`, tmdbId, title: tmdbId === 31132 ? "Regular Show" : "Bleach",
  year: 2010, posterPath: null, backdropPath: null, rating: 8, genres: [],
  seasonNumber, episodeNumber, episodeTitle: `Episode ${episodeNumber}`, addedAt,
  plexRatingKey: `episode-${tmdbId}-${seasonNumber}-${episodeNumber}`, file: null,
});
const series = (tmdbId: number, availableBySeason?: Record<number, number>): DashboardLibrarySeries => ({
  id: `series-${tmdbId}`, tmdbId, title: "Regular Show", year: 2010,
  posterPath: null, backdropPath: null, rating: 8, genres: [], addedAt: 1,
  hasAvailableEpisode: true, availableBySeason,
});

test("Regular Show : une saison importée devient une carte avec les non-vus de toute la saison", () => {
  const recent = [episode(31132, 3, 4), episode(31132, 3, 5)];
  const watched = [{ tmdbId: 31132, season: 3, episode: 1 }, { tmdbId: 31132, season: 3, episode: 2 }];
  const [card] = groupRecentEpisodes(recent, watched, [series(31132, { 3: 10 })]);
  assert.equal(card.latest.episodeNumber, 5);
  assert.equal(card.grouped, true);
  assert.equal(card.unwatchedCount, 8, "count the available season, not just the two recent files");
  assert.equal(card.fullyWatched, false);
  assert.equal(groupRecentEpisodes(recent, [], [series(31132, { 3: 10 })])[0].unwatchedCount, 10, "each profile has its own count");
});

test("un épisode seul conserve son identité et son état vu, sans compteur de saison", () => {
  const ep = episode(31132, 3, 5);
  const [card] = groupRecentEpisodes([ep], [{ tmdbId: 31132, season: 3, episode: 5 }], [series(31132, { 3: 10 })]);
  assert.equal(card.latest, ep);
  assert.equal(card.grouped, false);
  assert.equal(card.unwatchedCount, null);
  assert.equal(card.fullyWatched, true);
});

test("plusieurs saisons : le compteur suit la saison du dernier ajout, même sans total disponible", () => {
  const recent = [episode(31132, 2, 1, 40), episode(31132, 3, 2, 20), episode(31132, 2, 2, 30)];
  const watched = [{ tmdbId: 31132, season: 3, episode: 2 }, { tmdbId: 31132, season: 2, episode: 1 }];
  const [card] = groupRecentEpisodes(recent, watched, []);
  assert.equal(card.displaySeason, 2);
  assert.equal(card.unwatchedCount, 1);
  const [seen] = groupRecentEpisodes(recent, [...watched, { tmdbId: 31132, season: 2, episode: 2 }], []);
  assert.equal(seen.fullyWatched, true);
  assert.equal(seen.unwatchedCount, null);
});

test("Bleach original et TYBW restent deux cartes avec leurs coordonnées de présentation", () => {
  const cards = groupRecentEpisodes([episode(30984, 1, 1, 1), episode(30984, 17, 14, 3), episode(30984, 17, 15, 2)], [], []);
  assert.deepEqual(cards.map((c) => c.seriesPart), ["tybw", "original"]);
  assert.equal(cards[0].latest.title, "Bleach: Thousand-Year Blood War");
  assert.equal(cards[0].displaySeason, 2);
  assert.equal(cards[0].displayEpisode, 1);
  assert.equal(cards[0].latest.seasonNumber, 17, "playback retains canonical coordinates");
});

test("le regroupement précède la limite : un import massif ne masque pas les autres séries", () => {
  const bulk = Array.from({ length: 40 }, (_, i) => episode(31132, 3, i + 1, 1000));
  const cards = groupRecentEpisodes([...bulk, episode(1399, 1, 1, 900), episode(1396, 0, 1, 800)], [], []).slice(0, 20);
  assert.deepEqual(cards.map((c) => c.latest.tmdbId), [31132, 1399, 1396]);
  assert.equal(cards[0].unwatchedCount, 40);
  assert.equal(cards[2].displaySeason, 0);
  assert.deepEqual(groupRecentEpisodes([], [], []), []);
});
