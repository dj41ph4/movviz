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

test("parseNetflixCsv: date au format mois/jour/année (confirmé sur un vrai export — '7/27/26' ne peut être que juillet, 27 n'est pas un mois)", () => {
  const rows = parseNetflixCsv('Title,Date\n"X","7/27/26"');
  const d = new Date(rows[0].watchedAt!);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 6); // juillet = index 6
  assert.equal(d.getUTCDate(), 27);
});

test("parseNetflixCsv: si le premier nombre ne peut pas être un mois (>12), bascule en jour/mois/année", () => {
  const rows = parseNetflixCsv('Title,Date\n"X","27/7/26"');
  const d = new Date(rows[0].watchedAt!);
  assert.equal(d.getUTCMonth(), 6); // juillet
  assert.equal(d.getUTCDate(), 27);
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

test("classifyNetflixTitle: pas de chiffre dans le 2e segment => ce n'est pas un libellé de saison, il fait partie du titre de la série (saison 1 par défaut)", () => {
  // Cas réel confirmé sur un vrai export : "Monstre : L'histoire d'Ed Gein"
  // est le titre COMPLET de la série (elle contient elle-même un ':'),
  // Netflix ne donne aucun libellé de saison pour cette minisérie.
  const got = classifyNetflixTitle("Monstre : L'histoire d'Ed Gein: Radioamateur");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Monstre : L'histoire d'Ed Gein");
  assert.equal(got.seasonNumber, 1);
  assert.equal(got.episodeTitle, "Radioamateur");
});

test("classifyNetflixTitle: deux segments seulement => traité comme film (pas assez d'info)", () => {
  const got = classifyNetflixTitle("Movie Title: Subtitle");
  assert.equal(got.kind, "movie");
  assert.equal(got.movieTitle, "Movie Title: Subtitle");
});

test("classifyNetflixTitle: libellé de saison en français ('Saison N') reconnu au même titre que l'anglais", () => {
  const got = classifyNetflixTitle("La Voie du tablier: Saison 2: Épisode 3");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "La Voie du tablier");
  assert.equal(got.seasonNumber, 2);
  assert.equal(got.episodeTitle, "Épisode 3");
});

test("classifyNetflixTitle: 'Épisode N' seul en 2e segment n'est PAS une saison (bug confirmé sur un vrai export)", () => {
  // "Gloutons & Dragons: Épisode 24 : Raviolis, partie 2 / Œufs au bacon" —
  // l'ancienne règle ("un chiffre dans le 2e segment = numéro de saison")
  // cherchait à tort la saison 24 d'une série qui n'en a que 2 ou 3. "Épisode
  // N" n'est jamais un vrai libellé de saison chez Netflix.
  const got = classifyNetflixTitle("Gloutons & Dragons: Épisode 24 : Raviolis, partie 2 / Œufs au bacon");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Gloutons & Dragons");
  assert.equal(got.seasonNumber, 1);
  assert.equal(got.episodeTitle, "Raviolis, partie 2 / Œufs au bacon");
});

test("classifyNetflixTitle: 'Partie N' reconnu comme libellé de saison, au même titre que 'Saison N'", () => {
  const got = classifyNetflixTitle("Inside Job: Partie 2: Appleton");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Inside Job");
  assert.equal(got.seasonNumber, 2);
  assert.equal(got.episodeTitle, "Appleton");
});

test("classifyNetflixTitle: 'Volume N' reconnu comme libellé de saison", () => {
  const got = classifyNetflixTitle("Love, Death & Robots: Volume 4: Le complot des objets connectés");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Love, Death & Robots");
  assert.equal(got.seasonNumber, 4);
  assert.equal(got.episodeTitle, "Le complot des objets connectés");
});

test("classifyNetflixTitle: anthologie à 4 segments (titre de série contenant lui-même un ':' + nom d'arc) — tout sauf le dernier segment forme le titre de la série", () => {
  // "Demon Slayer: Kimetsu no Yaiba" est le titre réel (avec son propre
  // ':'), "Le quartier des plaisirs" est un nom d'arc, pas une saison
  // numérotée — ni SEASON_LABEL_RE ni BARE_EPISODE_LABEL_RE ne doivent
  // matcher ici, on retombe sur le repli anthologie existant.
  const got = classifyNetflixTitle("Demon Slayer: Kimetsu no Yaiba: Le quartier des plaisirs: À chaque réincarnation");
  assert.equal(got.kind, "episode");
  assert.equal(got.seriesTitle, "Demon Slayer: Kimetsu no Yaiba: Le quartier des plaisirs");
  assert.equal(got.seasonNumber, 1);
  assert.equal(got.episodeTitle, "À chaque réincarnation");
});
