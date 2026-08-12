import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// pathMappingStore/librarySync compute their config dir from MOVVIZ_CONFIG_DIR
// at module load time — must be set before the very first (dynamic) import.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-path-mapping-"));
process.env.MOVVIZ_CONFIG_DIR = workDir;

const { commonSuffixDepth, splitAtSuffixDepth } = await import("@/lib/library/pathSuffix");
const { learnPathMapping, applyLearnedPathMapping, loadPathMappings } = await import("@/lib/plex/pathMappingStore");
const { reconcileFilePath } = await import("@/lib/plex/librarySync");

// ── commonSuffixDepth / splitAtSuffixDepth ───────────────────────────────

test("commonSuffixDepth compte les segments finaux communs (insensible à la casse)", () => {
  assert.equal(commonSuffixDepth("/data/film/Movie (2020)/movie.mkv", "/volume1/docker/x/Movie (2020)/MOVIE.MKV"), 2);
  assert.equal(commonSuffixDepth("/data/film/Movie (2020)/movie.mkv", "/data/other/Movie (2020)/movie.mkv"), 2);
});

test("commonSuffixDepth retourne 0 sous le seuil minimum (1 segment commun)", () => {
  assert.equal(commonSuffixDepth("/data/film/a/movie.mkv", "/other/b/movie.mkv"), 0);
});

test("commonSuffixDepth retourne 0 quand rien ne correspond", () => {
  assert.equal(commonSuffixDepth("/data/film/a/movie.mkv", "/data/film/b/other.mkv"), 0);
});

test("splitAtSuffixDepth reconstruit exactement le chemin d'origine (POSIX)", () => {
  const p = "/volume1/docker/plex/film/Movie (2020)/movie.mkv";
  const { prefix, suffix } = splitAtSuffixDepth(p, 2);
  assert.equal(prefix, "/volume1/docker/plex/film");
  assert.equal(suffix, "Movie (2020)/movie.mkv");
  assert.equal(`${prefix}/${suffix}`, p);
});

test("splitAtSuffixDepth reconstruit exactement le chemin d'origine (Windows)", () => {
  const p = "D:\\Docker\\plex\\film\\Movie (2020)\\movie.mkv";
  const { prefix, suffix } = splitAtSuffixDepth(p, 2);
  assert.equal(prefix, "D:\\Docker\\plex\\film");
  assert.equal(suffix, "Movie (2020)\\movie.mkv");
  assert.equal(`${prefix}\\${suffix}`, p);
});

// ── applyLearnedPathMapping ───────────────────────────────────────────────

test("applyLearnedPathMapping: aucune correspondance → chemin inchangé", () => {
  const p = "/never/mapped/film/x/movie.mkv";
  assert.equal(applyLearnedPathMapping(p), p);
});

test("applyLearnedPathMapping: un seul préfixe appris → chemin réécrit", () => {
  learnPathMapping("/data/film", "/volume1/docker/plex/film");
  const rewritten = applyLearnedPathMapping("/data/film/Movie (2020)/movie.mkv");
  assert.equal(rewritten, "/volume1/docker/plex/film/Movie (2020)/movie.mkv");
});

test("applyLearnedPathMapping: préfixe le plus long l'emporte entre deux candidats qui se chevauchent", () => {
  learnPathMapping("/data", "/mnt/generic");
  learnPathMapping("/data/film/4k", "/mnt/uhd-film");
  const rewritten = applyLearnedPathMapping("/data/film/4k/Movie (2020)/movie.mkv");
  assert.equal(rewritten, "/mnt/uhd-film/Movie (2020)/movie.mkv");
  // Un chemin sous /data mais PAS sous /data/film/4k ne doit prendre que le préfixe générique.
  const other = applyLearnedPathMapping("/data/series/Show/S01E01.mkv");
  assert.equal(other, "/mnt/generic/series/Show/S01E01.mkv");
});

test("applyLearnedPathMapping: insensible à la casse (style Windows)", () => {
  learnPathMapping("Z:\\PLEX\\Films", "D:\\Movviz\\Films");
  const rewritten = applyLearnedPathMapping("z:\\plex\\films\\Movie (2020)\\movie.mkv");
  assert.equal(rewritten, "D:\\Movviz\\Films\\Movie (2020)\\movie.mkv");
});

test("learnPathMapping ne duplique pas une paire déjà connue", () => {
  const before = loadPathMappings().length;
  learnPathMapping("/data/film", "/volume1/docker/plex/film"); // déjà appris plus haut
  assert.equal(loadPathMappings().length, before);
});

// ── reconcileFilePath (learning trigger + verified-write guard) ──────────

function makeRealFile(...segments: string[]): string {
  const full = path.join(workDir, ...segments);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, "x");
  return full;
}

test("chemin existant vérifié + chemin Plex différent → apprend le mapping SANS écraser par le chemin brut Plex", () => {
  const movieFile = makeRealFile("movviz-film", "Movie A (2020)", "Movie A (2020).mkv");
  const plexPath = path.join(workDir, "plex-view", "film", "Movie A (2020)", "Movie A (2020).mkv");
  assert.equal(fs.existsSync(plexPath), false);

  const result = reconcileFilePath(movieFile, plexPath);

  // Jamais le chemin brut Plex (invérifiable) — le chemin vérifié existant est conservé.
  assert.equal(result, movieFile);
  assert.notEqual(result, plexPath);

  // La paire de préfixes a bien été apprise.
  const expectedMovvizPrefix = path.join(workDir, "movviz-film");
  const expectedPlexPrefix = path.join(workDir, "plex-view", "film");
  const learned = loadPathMappings().find(
    (m) => m.movvizPrefix === expectedMovvizPrefix && m.plexPrefix === expectedPlexPrefix
  );
  assert.ok(learned, "le mapping dérivé devrait être persisté");
});

test("chemin existant vérifié qui correspond déjà après mapping → no-op (pas de ré-écriture, pas de doublon appris)", () => {
  const movieFile = makeRealFile("movviz-film", "Movie A (2020)", "Movie A (2020).mkv");
  const plexPath = path.join(workDir, "plex-view", "film", "Movie A (2020)", "Movie A (2020).mkv");
  const before = loadPathMappings().length;

  const result = reconcileFilePath(movieFile, plexPath);

  assert.equal(result, movieFile);
  assert.equal(loadPathMappings().length, before);
});

test("nouvel item Plex sans enregistrement existant → chemin mappé appliqué s'il est vérifié sur disque", () => {
  const movieFile = makeRealFile("movviz-film", "Movie B (2021)", "Movie B (2021).mkv");
  const plexPath = path.join(workDir, "plex-view", "film", "Movie B (2021)", "Movie B (2021).mkv");

  const result = reconcileFilePath(null, plexPath);

  assert.equal(result, movieFile);
});

test("nouvel item Plex sans mapping connu pour ce préfixe → chemin brut Plex stocké tel quel", () => {
  const plexPath = path.join(workDir, "plex-view", "unmapped-root", "Movie C", "Movie C.mkv");
  const result = reconcileFilePath(null, plexPath);
  assert.equal(result, plexPath);
});

test("nouvel item Plex avec mapping connu mais chemin traduit invérifiable sur disque → jamais stocké, chemin brut Plex conservé", () => {
  const plexPath = path.join(workDir, "plex-view", "film", "Movie Ghost (2022)", "Movie Ghost (2022).mkv");
  // Le fichier mappé correspondant n'existe volontairement PAS sur disque.
  const wouldBeMappedPath = path.join(workDir, "movviz-film", "Movie Ghost (2022)", "Movie Ghost (2022).mkv");
  assert.equal(fs.existsSync(wouldBeMappedPath), false);

  const result = reconcileFilePath(null, plexPath);

  assert.equal(result, plexPath);
  assert.notEqual(result, wouldBeMappedPath);
});

test("chemin existant vérifié + mapping appris qui pointe vers un chemin invérifiable → jamais écrasé (le pire cas acceptable reste 'manquant', jamais un chemin halluciné)", () => {
  const realExisting = makeRealFile("movviz-film", "Movie D (2023)", "Movie D (2023).mkv");
  // Un mapping bidon, appris pour un tout autre titre, dont le côté Movviz ne correspond à rien de réel.
  learnPathMapping("/bogus/plexroot", "/bogus/movvizroot");
  const plexPath = "/bogus/plexroot/Something/Movie D (2023).mkv";

  const result = reconcileFilePath(realExisting, plexPath);

  assert.equal(result, realExisting);
  assert.notEqual(result, "/bogus/movvizroot/Something/Movie D (2023).mkv");
});

test("chemin existant enregistré mais absent du disque (fichier déplacé/supprimé) → traité comme un item neuf, mapping appliqué si vérifié", () => {
  const staleExistingPath = path.join(workDir, "movviz-film", "Movie B (2021) OLD", "gone.mkv");
  assert.equal(fs.existsSync(staleExistingPath), false);
  const movieFile = path.join(workDir, "movviz-film", "Movie B (2021)", "Movie B (2021).mkv");
  assert.equal(fs.existsSync(movieFile), true);
  const plexPath = path.join(workDir, "plex-view", "film", "Movie B (2021)", "Movie B (2021).mkv");

  const result = reconcileFilePath(staleExistingPath, plexPath);

  assert.equal(result, movieFile);
});
