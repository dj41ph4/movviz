import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stripCollisionSuffix, finalizeReplacedFiles, firstAddedAt } from "@/lib/library/applyImportedFiles";

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
  assert.deepEqual(await fsp.readdir(season), [path.basename(oldFile)]);
  await cleanup(root);
});

test("le nom final occupé par un fichier tiers n'est jamais écrasé", async () => {
  const { root, season } = await makeLibrary();
  const squatter = path.join(season, "Une menace plane - S01E01.mkv");
  const newFile = path.join(season, "Une menace plane - S01E01 (2).mkv");
  await fsp.writeFile(squatter, "fichier tiers");
  await fsp.writeFile(newFile, "nouvelle release");

  // Aucun ancien fichier connu de la bibliothèque : rien à supprimer.
  await assert.rejects(finalizeReplacedFiles([], [newFile], [root]), /occupé/);

  assert.equal(await fsp.readFile(squatter, "utf8"), "fichier tiers");
  assert.equal(await exists(newFile), true);
  await cleanup(root);
});

test("un ré-import sur le même chemin ne se supprime pas lui-même", async () => {
  const { root, season } = await makeLibrary();
  const file = path.join(season, "Une menace plane - S01E01.mkv");
  await fsp.writeFile(file, "même fichier");

  const renamed = await finalizeReplacedFiles([file], [file], [root]);

  assert.equal(await exists(file), true, "le fichier réimporté au même chemin doit survivre");
  assert.equal(renamed.size, 0);
  await cleanup(root);
});

test("un ancien fichier hors racine bibliothèque bloque le remplacement sans mentir sur le succès", async () => {
  const { root, season } = await makeLibrary();
  const outside = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-hors-"));
  const outsideOld = path.join(outside, "ailleurs - S01E01.mkv");
  const outsideNew = path.join(outside, "ailleurs - S01E01 (2).mkv");
  await fsp.writeFile(outsideOld, "hors bibliothèque");
  await fsp.writeFile(outsideNew, "hors bibliothèque aussi");

  await assert.rejects(finalizeReplacedFiles([outsideOld], [outsideNew], [root, season]), /hors bibliothèque du moteur/);

  assert.equal(await exists(outsideOld), true);
  assert.equal(await exists(outsideNew), true);
  await cleanup(root);
  await cleanup(outside);
});

test("un ancien fichier déjà absent permet de finaliser un callback rejoué", async () => {
  const { root, season } = await makeLibrary();
  const oldFile = path.join(season, "Une menace plane - S01E01.mkv");
  const newFile = path.join(season, "Une menace plane - S01E01 (2).mkv");
  await fsp.writeFile(newFile, "nouvelle release");

  const renamed = await finalizeReplacedFiles([oldFile], [newFile], [root]);

  assert.equal(await fsp.readFile(oldFile, "utf8"), "nouvelle release");
  assert.equal(renamed.get(newFile), oldFile);
  assert.deepEqual(await fsp.readdir(season), [path.basename(oldFile)]);
  await cleanup(root);
});

test("un fichier revu au même endroit garde sa date d'ajout, un vrai nouveau fichier prend la date du jour", () => {
  const first = Date.UTC(2026, 8, 20);
  const existing = { path: "/lib/H/Saison 3/H - S03E14.mkv", size: 1_000, addedAt: first };
  assert.equal(firstAddedAt(existing, existing.path, 1_000), first, "même fichier : jamais « tout juste ajouté »");
  const t0 = Date.now();
  assert.ok(firstAddedAt(existing, existing.path, 2_000) >= t0, "nouvelle release (taille différente) : date du jour");
  assert.ok(firstAddedAt(existing, "/lib/H/Saison 3/autre.mkv", 1_000) >= t0, "autre chemin : date du jour");
  assert.ok(firstAddedAt(null, existing.path, 1_000) >= t0, "premier import : date du jour");
});

async function cleanup(root: string) {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.match(path.basename(resolved), /^movviz-(import|hors)-/);
  await fsp.rm(resolved, { recursive: true, force: true });
}

test("nouveau absent, vide ou incomplet : ancien intact", async () => {
  const { root, season } = await makeLibrary();
  try {
    const old = path.join(season, "Film.mkv"), incoming = path.join(season, "Film (2).mkv");
    await fsp.writeFile(old, "ancien");
    await assert.rejects(finalizeReplacedFiles([old], [incoming], [root]));
    await fsp.writeFile(incoming, "");
    await assert.rejects(finalizeReplacedFiles([old], [incoming], [root]), /incomplet/);
    await fsp.writeFile(incoming, "nouveau");
    await assert.rejects(finalizeReplacedFiles([old], [incoming], [root], new Map([[incoming, 100]])), /incomplet/);
    assert.equal(await fsp.readFile(old, "utf8"), "ancien");
  } finally { await cleanup(root); }
});

test("échec du renommage : restauration de l'ancien et conservation du téléchargement", async t => {
  const { root, season } = await makeLibrary();
  try {
    const old = path.join(season, "Film.mkv"), incoming = path.join(season, "Film (2).mkv");
    await fsp.writeFile(old, "ancien");
    await fsp.writeFile(incoming, "nouveau");
    const rename = fsp.rename.bind(fsp);
    t.mock.method(fsp, "rename", async (from: Parameters<typeof fsp.rename>[0], to: Parameters<typeof fsp.rename>[1]) => {
      if (String(from) === incoming) throw new Error("renommage refusé");
      return rename(from, to);
    });
    await assert.rejects(finalizeReplacedFiles([old], [incoming], [root]), /renommage refusé/);
    assert.equal(await fsp.readFile(old, "utf8"), "ancien");
    assert.equal(await fsp.readFile(incoming, "utf8"), "nouveau");
    assert.equal((await fsp.readdir(season)).length, 2);
  } finally { await cleanup(root); }
});

test("nouvelle qualité : supprimer l'ancien seulement après installation au nom final", async t => {
  const { root, season } = await makeLibrary();
  try {
    const old = path.join(season, "Film-1080p.mkv"), incoming = path.join(season, "Film-2160p (2).mkv"), final = path.join(season, "Film-2160p.mkv");
    await fsp.writeFile(old, "ancien");
    await fsp.writeFile(incoming, "nouveau");
    const unlink = fsp.unlink.bind(fsp);
    t.mock.method(fsp, "unlink", async (file: Parameters<typeof fsp.unlink>[0]) => {
      assert.equal(await fsp.readFile(final, "utf8"), "nouveau");
      return unlink(file);
    });
    const renamed = await finalizeReplacedFiles([old], [incoming], [root]);
    assert.equal(renamed.get(incoming), final);
    assert.equal(await exists(old), false);
  } finally { await cleanup(root); }
});

test("nom final tiers : conserver l'ancien et refuser le remplacement", async () => {
  const { root, season } = await makeLibrary();
  try {
    const old = path.join(season, "Film-1080p.mkv"), incoming = path.join(season, "Film-2160p (2).mkv"), occupied = path.join(season, "Film-2160p.mkv");
    await fsp.writeFile(old, "ancien");
    await fsp.writeFile(incoming, "nouveau");
    await fsp.writeFile(occupied, "tiers");
    await assert.rejects(finalizeReplacedFiles([old], [incoming], [root]), /occupé/);
    assert.equal(await fsp.readFile(old, "utf8"), "ancien");
    assert.equal(await fsp.readFile(occupied, "utf8"), "tiers");
  } finally { await cleanup(root); }
});
