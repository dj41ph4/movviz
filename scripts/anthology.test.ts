import test from "node:test";
import assert from "node:assert/strict";
import { anthologyFor, anthologyTargetPath } from "../src/lib/library/anthology";

const prodTemplates = {
  enabled: true,
  movieFolder: "{title} ({year})",
  movieFile: "{title} ({year})",
  seriesFolder: "{title}",
  seasonFolder: "Saison {season}",
  episodeFile: "{title} - S{season:00}E{episode:00}",
  useDotsInsteadOfSpaces: false,
};

test("Monster : Dahmer, Menendez, Ed Gein et Lizzie Borden sont les saisons 1 à 4 de l'anthologie", () => {
  assert.equal(anthologyFor(113988)?.season, 1);
  assert.equal(anthologyFor(225634)?.season, 2);
  assert.equal(anthologyFor(286801)?.season, 3);
  assert.equal(anthologyFor(299939)?.season, 4);
  assert.equal(anthologyFor(30981), null, "l'anime Monster (2004) n'en fait pas partie");
});

test("Lizzie Borden est rangée dans Monster (2022)/Saison 4, là où Plex l'attend", () => {
  const from = "/data/série/Monstre : L'Histoire de Lizzie Borden/Saison 1/Monstre : L'Histoire de Lizzie Borden - S01E03.mp4";
  assert.equal(anthologyTargetPath(from, 299939, 1, 3, prodTemplates), "/data/série/Monster (2022)/Saison 4/Monster (2022) - S04E03.mp4");
  const edGein = "/data/série/Monstre : L'Histoire d'Ed Gein/Saison 1/Monstre : L'Histoire d'Ed Gein - S01E08.mp4";
  assert.equal(anthologyTargetPath(edGein, 286801, 1, 8, prodTemplates), "/data/série/Monster (2022)/Saison 3/Monster (2022) - S03E08.mp4");
});

test("un fichier déjà à sa place n'est jamais déplacé ni renommé (Dahmer, second passage)", () => {
  assert.equal(anthologyTargetPath("/volume1/docker/plex/série/Monster (2022)/Saison 1/Monster (2022) - S01E01.mkv", 113988, 1, 1, prodTemplates), null);
  assert.equal(anthologyTargetPath("/data/série/Monster (2022)/Saison 4/Monster (2022) - S04E03.mp4", 299939, 1, 3, prodTemplates), null);
  assert.equal(anthologyTargetPath("/data/série/Monster/Saison 1/Monster - S01E01.mkv", 30981, 1, 1, prodTemplates), null);
});
