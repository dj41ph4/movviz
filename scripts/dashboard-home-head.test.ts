import assert from "node:assert/strict";
import { test } from "node:test";
import { selectDashboardHomeHead } from "../src/lib/dashboard/homeHead.ts";
import type { DashboardInterfaceData } from "../src/lib/dashboard/interfaceTypes.ts";

const movie = (tmdbId: number, addedAt: number, status = "available") => ({ tmdbId, addedAt, status }) as DashboardInterfaceData["movies"][number];
const show = (tmdbId: number, latestAvailableAt: number, hasAvailableEpisode = true, addedAt = 1) =>
  ({ tmdbId, latestAvailableAt, hasAvailableEpisode, addedAt }) as DashboardInterfaceData["series"][number];
const payload = (partial: Partial<DashboardInterfaceData>) => ({ movies: [], series: [], recentEpisodes: [], ...partial }) as unknown as DashboardInterfaceData;

test("home head keeps the 20 newest available movies, newest first", () => {
  const movies = Array.from({ length: 25 }, (_, index) => movie(index + 1, index + 1));
  movies.push(movie(100, 999, "upcoming"));
  const head = selectDashboardHomeHead(payload({ movies }));
  assert.equal(head.movies.length, 20);
  assert.equal(head.movies[0].tmdbId, 25);
  assert.ok(!head.movies.some((item) => item.tmdbId === 100));
});

test("home head keeps a series with a recent episode even outside the newest 20", () => {
  const series = Array.from({ length: 25 }, (_, index) => show(index + 1, 100 + index));
  series.push(show(500, 1));
  const recentEpisodes = [{ tmdbId: 500 }] as DashboardInterfaceData["recentEpisodes"];
  const head = selectDashboardHomeHead(payload({ series, recentEpisodes }));
  assert.ok(head.series.some((item) => item.tmdbId === 500));
  assert.ok(head.series.some((item) => item.tmdbId === 25));
  assert.ok(!head.series.some((item) => item.tmdbId === 1));
  assert.deepEqual(head.recentEpisodes, recentEpisodes);
});

test("home head never reorders the shared memoized payload", () => {
  const movies = [movie(1, 1), movie(2, 2)];
  const series = [show(1, 1), show(2, 2)];
  selectDashboardHomeHead(payload({ movies, series }));
  assert.deepEqual(movies.map((item) => item.tmdbId), [1, 2]);
  assert.deepEqual(series.map((item) => item.tmdbId), [1, 2]);
});
