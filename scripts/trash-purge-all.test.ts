import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-trash-purge-"));
const config = path.join(root, "config");
const seriesTrash = path.join(root, "corbeille", "serie");
fs.mkdirSync(config, { recursive: true });
fs.mkdirSync(seriesTrash, { recursive: true });
const previous = process.env.MOVVIZ_CONFIG_DIR;
process.env.MOVVIZ_CONFIG_DIR = config;

after(async () => {
  const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
  flushPendingJsonWritesSync();
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
  if (previous === undefined) delete process.env.MOVVIZ_CONFIG_DIR;
  else process.env.MOVVIZ_CONFIG_DIR = previous;
});

test("la purge manuelle supprime tous les fichiers de la corbeille, quel que soit leur âge, et seulement eux", async () => {
  const { setTrashConfig, addTrashEntry, loadTrashManifest } = await import("@/lib/library/trashStore");
  const { purgeAllTrashFiles } = await import("@/lib/library/trashPurge");
  setTrashConfig({ seriesPath: seriesTrash, moviesPath: null });
  const recent = path.join(seriesTrash, "Show - S01E01.mkv");
  const old = path.join(seriesTrash, "Show - S01E02.mkv");
  const outside = path.join(root, "library-file.mkv");
  for (const f of [recent, old, outside]) fs.writeFileSync(f, "x");
  addTrashEntry({ id: "recent", kind: "series", title: "r", trashPath: recent, deletedAt: Date.now() });
  addTrashEntry({ id: "old", kind: "series", title: "o", trashPath: old, deletedAt: Date.now() - 90 * 86_400_000 });
  // An entry pointing outside the trash root must never be deleted.
  addTrashEntry({ id: "outside", kind: "series", title: "x", trashPath: outside, deletedAt: Date.now() });

  const result = await purgeAllTrashFiles();
  assert.deepEqual(result, { purged: 2, failed: 1 });
  assert.equal(fs.existsSync(recent), false);
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(outside), true, "un fichier hors de la corbeille n'est jamais supprimé");
  assert.deepEqual(loadTrashManifest().map((e) => e.id), ["outside"]);
});

test("sans dossier de corbeille configuré, la purge manuelle ne supprime rien", async () => {
  const { setTrashConfig, addTrashEntry } = await import("@/lib/library/trashStore");
  const { purgeAllTrashFiles } = await import("@/lib/library/trashPurge");
  setTrashConfig({ seriesPath: null, moviesPath: null });
  const file = path.join(seriesTrash, "keep.mkv");
  fs.writeFileSync(file, "x");
  addTrashEntry({ id: "keep", kind: "series", title: "k", trashPath: file, deletedAt: 0 });
  const result = await purgeAllTrashFiles();
  assert.equal(result.purged, 0);
  assert.equal(fs.existsSync(file), true);
});
