import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNetflixCsv, classifyNetflixTitle } from "@/lib/netflix/parseHistory";

test("parseNetflixCsv: ignore l'en-tête, parse titre + date", () => {
  const csv = 'Title,Date\n"Inception","15/03/24"\n"The Batman","01/01/23"';
  const rows = parseNetflixCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Inception");
  assert.ok(rows[0].watchedAt != null);
  assert.equal(rows[1].title, "The Batman");
});

test("parseNetflixCsv: gère un titre contenant une virgule (champ entre guillemets)", () => {
  const csv = 'Title,Date\n"Dumb, Dumber and Dumberer","10/05/22"';
  const rows = parseNetflixCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Dumb, Dumber and Dumberer");
});

test("parseNetflixCsv: lignes vides ignorées, plafond de lignes respecté", () => {
  const csv = "Title,Date\n\n\"A\",\"01/01/24\"\n\n";
  const rows = parseNetflixCsv(csv);
  assert.equal(rows.length, 1);
});

test("parseNetflixCsv: date ISO reconnue", () => {
  const rows = parseNetflixCsv('Title,Date\n"X","2024-03-15"');
  assert.ok(rows[0].watchedAt != null);
});

test("parseNetflixCsv: date illisible ne fait pas planter, watchedAt = null", () => {
  const rows = parseNetflixCsv('Title,Date\n"X","n\'importe quoi"');
  assert.equal(rows[0].watchedAt, null);
});

test("classifyNetflixTitle: titre simple = film", () => {
  const got = classifyNetflixTitle("Inception");
  assert.deepEqual(got, { kind: "movie", movieTitle: "Inception" });
});

test("classifyNetflixTitle: 'Série: Saison X: Titre épisode' = épisode", () => {
  const got = classifyNetflixTitle("The Boys: Season 3: Herogasm");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "The Boys");
  assert.equal(got.seasonNumber, 3);
  assert.equal(got.episodeTitle, "Herogasm");
});

test("classifyNetflixTitle: titre d'épisode contenant lui-même un ':' reste entier", () => {
  const got = classifyNetflixTitle("Stranger Things: Season 1: Chapter One: The Vanishing of Will Byers");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Stranger Things");
  assert.equal(got.seasonNumber, 1);
  assert.equal(got.episodeTitle, "Chapter One: The Vanishing of Will Byers");
});

test("classifyNetflixTitle: pas de numéro dans le libellé de saison => saison 1 par défaut", () => {
  const got = classifyNetflixTitle("Some Show: Limited Series: The Only Episode");
  assert.equal(got.kind, "episode");
  assert.equal(got.seasonNumber, 1);
});

test("classifyNetflixTitle: deux segments seulement => traité comme film (pas assez d'info)", () => {
  const got = classifyNetflixTitle("Movie Title: Subtitle");
  assert.equal(got.kind, "movie");
  assert.equal(got.movieTitle, "Movie Title: Subtitle");
});
