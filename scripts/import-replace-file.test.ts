import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stripCollisionSuffix, finalizeReplacedFiles } from "@/lib/library/applyImportedFiles";

/** Racine bibliothèque jetable + une saison dedans (profondeur ≥ 2 exigée par les gardes de suppression). */
async function makeLibrary(): Promise<{ root: string; season: string }> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-import-"));
  const season = path.join(root, "Une menace plane", "Saison 1");
  await fsp.mkdir(season, { recursive: true });
  return { root, season };
}

const exists = (p: string) => fsp.access(p).then(() => true).catch(() => false);

test("le suffixe de collision se lit avant l'extension, pas à la fin du nom", () => {
  assert.equal(stripCollisionSuffix("Serie - S01E01 (2).mkv", path.posix), "Serie - S01E01.mkv");
  assert.equal(stripCollisionSuffix("Serie - S01E01 (13).mkv", path.posix), "Serie - S01E01.mkv");
  assert.equal(stripCollisionSuffix("Serie - S01E01.mkv", path.posix), "Serie - S01E01.mkv");
  // Un titre qui contient légitimement une année/numéro entre parenthèses ne bouge pas.
  assert.equal(stripCollisionSuffix("Film (2019) - 1080p.mkv", path.posix), "Film (2019) - 1080p.mkv");
});

test("un épisode déjà présent est remplacé : ancien fichier supprimé, nouveau ramené au nom final", async () => {
  const { root, season } = await makeLibrary();
  const oldFile = path.join(season, "Une menace plane - S01E01.mkv");
  const newFile = path.join(season, "Une menace plane - S01E01 (2).mkv");
  await fsp.writeFile(oldFile, "ancienne release");
  await fsp.writeFile(newFile, "nouvelle release");

  const renamed = await finalizeReplacedFiles([oldFile], [newFile], [root]);

  assert.equal(await exists(oldFile), true, "le nom final doit exister (le nouveau fichier y a été ramené)");
  assert.equal(await exists(newFile), false, "le fichier « (2) » ne doit plus traîner à côté");
  assert.equal(await fsp.readFile(oldFile, "utf8"), "nouvelle release");
  assert.equal(renamed.get(newFile), oldFile);
  await fsp.rm(root, { recursive: true, force: true });
});

test("le nom final occupé par un fichier tiers n'est jamais écrasé", async () => {
  const { root, season } = await makeLibrary();
  const squatter = path.join(season, "Une menace plane - S01E01.mkv");
  const newFile = path.join(season, "Une menace plane - S01E01 (2).mkv");
  await fsp.writeFile(squatter, "fichier tiers");
  await fsp.writeFile(newFile, "nouvelle release");

  // Aucun ancien fichier connu de la bibliothèque : rien à supprimer.
  const renamed = await finalizeReplacedFiles([], [newFile], [root]);

  assert.equal(await fsp.readFile(squatter, "utf8"), "fichier tiers");
  assert.equal(await exists(newFile), true);
  assert.equal(renamed.size, 0);
  await fsp.rm(root, { recursive: true, force: true });
});

test("un ré-import sur le même chemin ne se supprime pas lui-même", async () => {
  const { root, season } = await makeLibrary();
  const file = path.join(season, "Une menace plane - S01E01.mkv");
  await fsp.writeFile(file, "même fichier");

  const renamed = await finalizeReplacedFiles([file], [file], [root]);

  assert.equal(await exists(file), true, "le fichier réimporté au même chemin doit survivre");
  assert.equal(renamed.size, 0);
  await fsp.rm(root, { recursive: true, force: true });
});

test("un fichier hors racine bibliothèque n'est ni supprimé ni renommé", async () => {
  const { root, season } = await makeLibrary();
  const outside = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-hors-"));
  const outsideOld = path.join(outside, "ailleurs - S01E01.mkv");
  const outsideNew = path.join(outside, "ailleurs - S01E01 (2).mkv");
  await fsp.writeFile(outsideOld, "hors bibliothèque");
  await fsp.writeFile(outsideNew, "hors bibliothèque aussi");

  const renamed = await finalizeReplacedFiles([outsideOld], [outsideNew], [root, season]);

  assert.equal(await exists(outsideOld), true);
  assert.equal(await exists(outsideNew), true);
  assert.equal(renamed.size, 0);
  await fsp.rm(root, { recursive: true, force: true });
  await fsp.rm(outside, { recursive: true, force: true });
});
