import assert from "node:assert/strict";
import { test } from "node:test";
import { selectRecentlyAdded, seriesFirstAvailableAt } from "../src/lib/dashboard/recentlyAdded.ts";
import { selectDashboardHomeHead } from "../src/lib/dashboard/homeHead.ts";
import { recentEpisodePage } from "../src/lib/library/recentEpisodes.ts";
import type { DashboardInterfaceData } from "../src/lib/dashboard/interfaceTypes.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 16);

type Episode = { status: string; file?: { addedAt: number } | null };
const ep = (addedAt: number | null, status = "available"): Episode => ({ status, file: addedAt === null ? null : { addedAt } });
const showFrom = (tmdbId: number, addedAt: number, episodes: Episode[]) => {
  const seasons = [{ episodes }];
  return {
    tmdbId,
    addedAt,
    firstAvailableAt: seriesFirstAvailableAt(seasons),
    hasAvailableEpisode: episodes.some((episode) => episode.status === "available"),
  };
};
const movie = (tmdbId: number, addedAt: number, fileAt?: number, status = "available") =>
  ({ tmdbId, addedAt, status, latestAvailableAt: status === "available" ? fileAt ?? addedAt : undefined });
const ids = (entries: { type: string; item: { tmdbId: number } }[]) => entries.map(({ type, item }) => `${type}:${item.tmdbId}`);

test("une série ancienne qui reçoit un nouvel épisode n'entre pas dans Ajouts récents (Star Academy)", () => {
  // Premier épisode arrivé il y a 60 jours, épisode 49 arrivé à l'instant.
  const starAcademy = showFrom(1, NOW - 90 * DAY, [ep(NOW - 60 * DAY), ep(NOW - 30 * DAY), ep(NOW)]);
  const movies = Array.from({ length: 20 }, (_, index) => movie(100 + index, NOW - (index + 1) * DAY));
  const row = selectRecentlyAdded(movies, [starAcademy]);
  assert.equal(row.length, 20);
  assert.ok(!ids(row).includes("series:1"));
});

test("le nouvel épisode reste dans la rangée « Épisodes récemment ajoutés »", () => {
  const page = recentEpisodePage([
    { seriesId: "s1", tmdbId: 1, title: "Star Academy", seasonNumber: 14, episodeNumber: 49, addedAt: NOW },
  ]);
  assert.ok(page.episodes.some((episode) => episode.tmdbId === 1 && episode.episodeNumber === 49));
});

test("une série ajoutée récemment est présente, épisodes compris, datée par son premier épisode", () => {
  const fresh = showFrom(2, NOW - 2 * DAY, [ep(NOW - 2 * DAY), ep(NOW)]);
  const old = showFrom(3, NOW - 100 * DAY, [ep(NOW - 100 * DAY), ep(NOW - 1)]);
  const row = selectRecentlyAdded([movie(10, NOW - 5 * DAY)], [old, fresh]);
  assert.deepEqual(ids(row), ["series:2", "movie:10", "series:3"]);
});

test("une série déjà présente comme manquante entre au téléchargement de son premier épisode", () => {
  // Demandée il y a 200 jours, rien de téléchargé jusqu'à hier.
  const requested = showFrom(4, NOW - 200 * DAY, [ep(NOW - DAY), ep(null, "missing")]);
  const row = selectRecentlyAdded([movie(11, NOW - 3 * DAY)], [requested]);
  assert.deepEqual(ids(row), ["series:4", "movie:11"]);
});

test("une série sans épisode disponible n'apparaît pas", () => {
  const empty = showFrom(5, NOW, [ep(null, "missing")]);
  assert.deepEqual(selectRecentlyAdded([], [empty]), []);
});

test("un film récent est présent, daté par l'arrivée de son fichier", () => {
  // Demandé il y a 100 jours, fichier arrivé aujourd'hui → en tête.
  const row = selectRecentlyAdded([movie(20, NOW - 10 * DAY), movie(21, NOW - 100 * DAY, NOW)], []);
  assert.deepEqual(ids(row), ["movie:21", "movie:20"]);
  assert.ok(!ids(selectRecentlyAdded([movie(22, NOW, undefined, "missing")], [])).includes("movie:22"));
});

test("sans date de fichier (Plex absent ou hors ligne), la date d'ajout sert de repli", () => {
  const undated = showFrom(6, NOW - DAY, [ep(null)]);
  assert.equal(undated.firstAvailableAt, 0);
  const row = selectRecentlyAdded([movie(30, NOW - 2 * DAY)], [undated]);
  assert.deepEqual(ids(row), ["series:6", "movie:30"]);
});

test("le préchargement Android garde l'ancienne série grâce à son épisode récent, sans la classer parmi les nouvelles", () => {
  const series = Array.from({ length: 20 }, (_, index) => showFrom(100 + index, NOW - index * DAY, [ep(NOW - index * DAY)]));
  const starAcademy = showFrom(1, NOW - 90 * DAY, [ep(NOW - 60 * DAY), ep(NOW)]);
  const payload = { movies: [], series: [...series, starAcademy], recentEpisodes: [{ tmdbId: 1 }] } as unknown as DashboardInterfaceData;
  const head = selectDashboardHomeHead(payload);
  assert.ok(head.series.some((show) => show.tmdbId === 1));
  assert.equal(selectRecentlyAdded([], payload.series).some(({ item }) => item.tmdbId === 1), false);
});
