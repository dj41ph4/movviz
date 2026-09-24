import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * Règle absolue : aucune perte. La réconciliation disque ne supprime jamais
 * de fichier, mais un titre envoyé à tort en corbeille puis supprimé
 * définitivement demanderait à Plex d'effacer le média. Une passe qui déclare
 * d'un coup une grosse part de la bibliothèque introuvable (stockage
 * indisponible) ne doit donc rien déplacer. Exécuté dans un processus à part
 * avec son propre dossier de données — jamais la vraie bibliothèque.
 */

function runInIsolatedLibrary(missingCount: number): { result: Record<string, number>; available: number; trash: number } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-reconcile-"));
  const movies = Array.from({ length: 100 }, (_, i) => ({
    id: `mov_${i}`, tmdbId: 1000 + i, title: `Film ${i}`, year: 2000, status: "available",
    file: { path: `/data/film/Film ${i}/Film ${i}.mkv` }, addedAt: i, activeInfoHash: null,
  }));
  fs.writeFileSync(path.join(dir, "library-movies.json"), JSON.stringify(movies));
  fs.writeFileSync(path.join(dir, "library-series.json"), "[]");
  const issues = movies.slice(0, missingCount).map((m) => ({ kind: "missing", path: m.file.path }));
  const script = `
    const { applyMissingFileTrash } = await import("@/lib/library/reconcileTrash");
    const { loadMovies } = await import("@/lib/library/store");
    const { loadTrash } = await import("@/lib/library/trashStore");
    const result = applyMissingFileTrash(${JSON.stringify(issues)});
    await new Promise((r) => setTimeout(r, 800));
    console.log(JSON.stringify({ result, available: loadMovies().filter((m) => m.status === "available").length, trash: loadTrash().length }));
  `;
  const out = execFileSync(
    process.execPath,
    ["--experimental-transform-types", "--no-warnings", "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", script],
    { env: { ...process.env, MOVVIZ_DATA_DIR: dir, MOVVIZ_CONFIG_DIR: dir, MOVVIZ_CONTEXT_ENGINE_DISABLED: "1" }, encoding: "utf8" },
  );
  return JSON.parse(out.trim().split("\n").pop()!);
}

test("quelques fichiers réellement disparus : leurs titres passent en corbeille (comportement inchangé)", () => {
  const { result, available, trash } = runInIsolatedLibrary(10);
  assert.equal(result.movies, 10);
  assert.equal(result.blockedMissing, undefined);
  assert.equal(available, 90);
  assert.equal(trash, 10);
});

test("disparition massive (stockage indisponible) : rien n'est touché", () => {
  const { result, available, trash } = runInIsolatedLibrary(60);
  assert.equal(result.blockedMissing, 60);
  assert.equal(result.movies, 0);
  assert.equal(available, 100);
  assert.equal(trash, 0);
});

function reconcileOnRealDisk(rootExists: boolean): { missing: string[]; untracked: string[] } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-reconcile-disk-"));
  const root = path.join(dir, "films");
  const names = ["A", "B", "C"];
  if (rootExists) {
    for (const n of names) { fs.mkdirSync(path.join(root, n), { recursive: true }); fs.writeFileSync(path.join(root, n, `${n}.mkv`), ""); }
    fs.mkdirSync(path.join(root, "Extra"), { recursive: true });
    fs.writeFileSync(path.join(root, "Extra", "Extra.mkv"), "");
  }
  const movies = [...names, "Gone"].map((n, i) => ({
    id: `mov_${i}`, tmdbId: 2000 + i, title: n, year: 2000, status: "available",
    file: { path: path.join(root, n, `${n}.mkv`) }, addedAt: i, activeInfoHash: null,
  }));
  fs.writeFileSync(path.join(dir, "library-movies.json"), JSON.stringify(movies));
  fs.writeFileSync(path.join(dir, "library-series.json"), "[]");
  const script = `
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ instances: [{ completedPath: ${JSON.stringify(root)} }] }) });
    const { reconcileLibrary } = await import("@/lib/library/reconcile");
    const issues = await reconcileLibrary();
    console.log(JSON.stringify({
      missing: issues.filter((i) => i.kind === "missing").map((i) => i.path),
      untracked: issues.filter((i) => i.kind === "untracked").map((i) => i.path),
    }));
  `;
  const out = execFileSync(
    process.execPath,
    ["--experimental-transform-types", "--no-warnings", "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", script],
    { env: { ...process.env, MOVVIZ_DATA_DIR: dir, MOVVIZ_CONFIG_DIR: dir, MOVVIZ_CONTEXT_ENGINE_DISABLED: "1" }, encoding: "utf8" },
  );
  if (rootExists) {
    for (const n of [...names, "Extra"]) assert.ok(fs.existsSync(path.join(root, n, `${n}.mkv`)), `${n}.mkv doit toujours exister`);
  }
  return JSON.parse(out.trim().split("\n").pop()!);
}

test("réconciliation sur vrais fichiers : seul le fichier réellement absent est signalé, aucun fichier touché", () => {
  const { missing, untracked } = reconcileOnRealDisk(true);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /Gone\.mkv$/i);
  assert.equal(untracked.length, 1);
  assert.match(untracked[0], /Extra\.mkv$/i);
});

test("racine démontée : aucun fichier déclaré absent", () => {
  const { missing } = reconcileOnRealDisk(false);
  assert.deepEqual(missing, []);
});
