import assert from "node:assert/strict";
import { test } from "node:test";
import { interleaveMoviesAndSeries } from "../src/lib/discover/interleave.ts";

type T = { tmdbId: number; type: "movie" | "series" };
const m = (tmdbId: number): T => ({ tmdbId, type: "movie" });
const s = (tmdbId: number): T => ({ tmdbId, type: "series" });
const ids = (list: { tmdbId: number; type: string }[]) => list.map((x) => `${x.type[0]}${x.tmdbId}`);

test("une carte sur deux : film, série, film, série…", () => {
  assert.deepEqual(ids(interleaveMoviesAndSeries([m(1), m(2), m(3)], [s(1), s(2), s(3)])), ["m1", "s1", "m2", "s2", "m3", "s3"]);
});

test("quand un type est épuisé, le reste de l'autre suit — aucune carte perdue", () => {
  assert.deepEqual(ids(interleaveMoviesAndSeries([m(1)], [s(1), s(2), s(3)])), ["m1", "s1", "s2", "s3"]);
  assert.deepEqual(ids(interleaveMoviesAndSeries([m(1), m(2), m(3)], [])), ["m1", "m2", "m3"]);
});

test("un même titre n'apparaît qu'une fois et l'ordre de chaque liste est conservé", () => {
  assert.deepEqual(ids(interleaveMoviesAndSeries([m(1), m(1), m(2)], [s(5), s(5)])), ["m1", "s5", "m2"]);
});

test("un film et une série de même identifiant TMDb restent deux titres distincts", () => {
  assert.deepEqual(ids(interleaveMoviesAndSeries([m(7)], [s(7)])), ["m7", "s7"]);
});
