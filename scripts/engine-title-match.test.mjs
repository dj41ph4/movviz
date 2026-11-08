import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";
import { assignFilesByTitle, normalizeEpisodeTitle } from "../engine/src/episodeTitleMatch.mjs";

// Extrait réel de l'intégrale « Batman La Série Animée … Intégral (109EP) » : numérotation de
// production (001, 002…) qui ne suit pas TMDb, titres français, 2 parties, titres traduits autrement.
const REL = "Batman La Série Animée (Batman The Animated Serie) 1992-1998 Intégral (109EP) TrueFrench 1080p HDLight BluRay AC3 x265-Thebatou8652";
const FILE_NAMES = [
  "001 Le Chat et La Souris (1re partie).mkv", "002 Le Chat et La Souris (2e partie).mkv", "003 Le Duel.mkv",
  "004 Amour de Glace.mkv", "005 Bas les Masques (1re partie).mkv", "006 Bas les Masques (2e partie).mkv",
  "007 Il N’est Jamais Trop Tard.mkv", "008 Chantage à Crédit.mkv", "009 Poison D’Amour.mkv",
  "047 Harley et Ivy.mkv", "051 Robin se Rebiffe (1re partie).mkv", "052 Robin se Rebiffe (2e partie).mkv",
  "053 Monsieur Pingouin.mkv", "086 Le Retour de Robin.mkv", "092 Joker S'achète Une Conduite.mkv", "x.nfo",
];
const TARGETS = [
  [1, 1, "Le Chat et la Souris (1)"], [1, 2, "Le Duel"], [1, 3, "Amour on ice"], [1, 4, "Bas les masques (1)"],
  [1, 5, "Bas les masques (2)"], [1, 6, "Il n’est jamais trop tard"], [1, 7, "Chantage à crédit"],
  [1, 8, "Le Chat et la Souris (2)"], [1, 9, "Poison d’amour"], [1, 47, "Harley & Ivy"],
  [1, 51, "Robin se rebiffe (1)"], [1, 52, "Monsieur Pingouin"], [1, 53, "Robin se rebiffe (2)"],
].map(([season, episode, title]) => ({ season, episode, title }));
const files = FILE_NAMES.map((name) => ({ name, path: `${REL}/${name}`, length: 200_000_000 }));
const backend = Object.create(AbstractBackend.prototype);

test("un titre se normalise sans numéro, accents, ponctuation, et la partie est extraite", () => {
  assert.deepEqual(normalizeEpisodeTitle("002 Le Chat et La Souris (2e partie).mkv"), { base: "le chat et la souris", tokens: ["chat", "souris"], part: 2 });
  assert.equal(normalizeEpisodeTitle("Le Chat et la Souris (2)").part, 2);
  assert.equal(normalizeEpisodeTitle("Harley & Ivy").base, normalizeEpisodeTitle("047 Harley et Ivy.mkv").base);
  assert.equal(normalizeEpisodeTitle("L’Œuf du Pingouin").base, normalizeEpisodeTitle("020 L’Œuf du Pingouin.mkv").base);
});

test("chaque fichier d'un pack numéroté à sa façon rejoint l'épisode du même titre, pas du même numéro", () => {
  const map = backend._titleAssignment(files, TARGETS);
  const of = (name) => { const t = map.get(`${REL}/${name}`); return t && `${t.season}x${t.episode}`; };
  assert.equal(of("001 Le Chat et La Souris (1re partie).mkv"), "1x1");
  assert.equal(of("002 Le Chat et La Souris (2e partie).mkv"), "1x8"); // pas 1x2
  assert.equal(of("003 Le Duel.mkv"), "1x2"); // pas 1x3
  assert.equal(of("053 Monsieur Pingouin.mkv"), "1x52");
  assert.equal(of("052 Robin se Rebiffe (2e partie).mkv"), "1x53");
  assert.equal(of("047 Harley et Ivy.mkv"), "1x47");
  // Titre traduit autrement : retrouvé par le décalage constant entre ses voisins appariés.
  assert.equal(of("004 Amour de Glace.mkv"), "1x3");
  // Hors de la bibliothèque (autre série du pack) : jamais rangé sous un épisode au hasard.
  assert.equal(of("086 Le Retour de Robin.mkv"), undefined);
  assert.equal(of("092 Joker S'achète Une Conduite.mkv"), undefined);
});

test("la sélection et l'import utilisent l'appariement par titre", () => {
  let selected;
  backend._clientSelectFiles = (_handle, indices) => { selected = [...indices]; };
  backend._selectEpisodeFiles({ name: REL, files }, { episodeTargets: TARGETS });
  assert.deepEqual(selected.map((i) => files[i].name.slice(0, 3)).sort(), ["001", "002", "003", "004", "005", "006", "007", "008", "009", "047", "051", "052", "053"]);
  const map = backend._titleAssignment(files, TARGETS);
  const chat2 = files.find((f) => f.name.startsWith("002"));
  assert.equal(backend._matchesEpisode(chat2, TARGETS[7], TARGETS, map), true);
  assert.equal(backend._matchesEpisode(chat2, TARGETS[1], TARGETS, map), false);
});

test("sans titre de cible, ou avec des noms déjà au format SxxExx, l'ancienne logique reste seule en jeu", () => {
  assert.equal(backend._titleAssignment(files, TARGETS.map(({ season, episode }) => ({ season, episode }))), null);
  const explicit = [{ name: "Show.S01E01.mkv", path: "Show.S01E01.mkv" }, { name: "Show.S01E02.mkv", path: "Show.S01E02.mkv" }];
  assert.equal(backend._titleAssignment(explicit, [{ season: 1, episode: 1, title: "Pilot" }]), null);
});

test("un pack dont les titres ne correspondent pas n'est pas apparié (retour à l'ancienne logique)", () => {
  const unrelated = ["01 Alpha.mkv", "02 Beta.mkv", "03 Gamma.mkv"].map((name) => ({ name, path: name }));
  const targets = [{ season: 1, episode: 1, title: "Zèbre" }, { season: 1, episode: 2, title: "Yéti" }, { season: 1, episode: 3, title: "Xénon" }];
  assert.equal(assignFilesByTitle(unrelated, targets, () => true), null);
});
