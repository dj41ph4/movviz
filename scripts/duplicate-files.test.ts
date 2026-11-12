import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import des stores : jamais la vraie bibliothèque.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-duplicates-"));
const config = path.join(root, "config");
const media = path.join(root, "media");
const season = path.join(media, "Serie", "Saison 1");
fs.mkdirSync(config, { recursive: true });
fs.mkdirSync(season, { recursive: true });
process.env.MOVVIZ_CONFIG_DIR = config;

const { scanDuplicateFiles, resolveDuplicateFiles, loadDuplicateReport } = await import("../src/lib/library/duplicateFiles.ts");

const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");
after(() => {
  flushPendingJsonWritesSync();
  fs.rmSync(root, { recursive: true, force: true });
});

const put = (rel: string, size = 1024) => {
  const p = path.join(season, rel);
  fs.writeFileSync(p, Buffer.alloc(size, 7));
  return p;
};
const file = (p: string) => ({ path: p, diskPath: p, quality: "WEB 1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size: 1024, addedAt: 1 });
const episode = (n: number, p: string) => ({
  seasonNumber: 1, episodeNumber: n, title: `E${n}`, airDate: "2020-01-01", monitored: true, status: "available",
  file: file(p), activeInfoHash: null, plexRatingKey: "7",
});

const e1 = put("Serie - S01E01.mkv");
const e1dup = put("Serie - S01E01 (2).mkv");
const e1dup2 = put("Serie - S01E01 (6).mkv", 2048);
const e2orphan = put("Serie - S01E02 (2).mkv");
const e3 = put("Serie - S01E03.mkv");
const e3used = put("Serie - S01E03 (2).mkv");
const sub = put("Serie - S01E01 (2).srt");
fs.mkdirSync(path.join(media, "@eaDir"), { recursive: true });
const hidden = path.join(media, "@eaDir", "Serie - S01E09 (2).mkv");
fs.writeFileSync(hidden, "x");

fs.writeFileSync(path.join(config, "library-movies.json"), "[]");
fs.writeFileSync(
  path.join(config, "library-series.json"),
  JSON.stringify([{
    id: "sr_1", tmdbId: 9, title: "Serie", year: 2020, overview: "", posterPath: null, backdropPath: null, rating: 0, monitored: true,
    // Le remplacement d'un épisode a gardé « (2) » comme fichier : il est utilisé, jamais supprimé.
    seasons: [{ seasonNumber: 1, monitored: true, episodes: [episode(1, e1), episode(3, e3used)] }],
  }])
);

// Les fichiers viennent d'être créés : la fenêtre « récent » les protège tant qu'on n'avance pas l'horloge.
const later = Date.now() + 2 * 60 * 60 * 1000;
const byName = (items: { name: string; state: string }[]) => Object.fromEntries(items.map((i) => [i.name, i.state]));

test("un fichier fraîchement écrit est « récent » : jamais proposé à la suppression", async () => {
  const report = await scanDuplicateFiles([media]);
  assert.ok(report.items.length > 0);
  assert.ok(report.items.every((i) => i.state === "recent" || i.state === "in_use"));
  const r = await resolveDuplicateFiles([e1dup], [media], "admin");
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "recent");
  assert.ok(fs.existsSync(e1dup));
});

test("le balayage classe doublon, sans original, utilisé — et ignore sous-titres et dossiers NAS", async () => {
  const report = await scanDuplicateFiles([media], undefined, { now: later });
  assert.deepEqual(byName(report.items), {
    "Serie - S01E01 (2).mkv": "duplicate",
    "Serie - S01E01 (6).mkv": "duplicate",
    "Serie - S01E02 (2).mkv": "no_original",
    "Serie - S01E03 (2).mkv": "in_use",
  });
  const six = report.items.find((i) => i.name.includes("(6)"))!;
  assert.equal(six.originalSize, 1024);
  assert.equal(six.size, 2048);
  assert.equal(loadDuplicateReport().items.length, 4, "le rapport est enregistré");
});

test("un fichier utilisé par la bibliothèque n'est jamais supprimé, même demandé", async () => {
  const r = await resolveDuplicateFiles([e3used], [media], "admin", later);
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "in_use");
  assert.ok(fs.existsSync(e3used));
});

test("un fichier hors rapport n'est pas touché, y compris l'original", async () => {
  const r = await resolveDuplicateFiles([e1, sub, hidden], [media], "admin", later);
  assert.equal(r.done.length, 0);
  assert.ok(r.failed.every((f) => f.error === "not_in_report"));
  assert.ok(fs.existsSync(e1) && fs.existsSync(sub) && fs.existsSync(hidden));
});

test("un fichier modifié depuis le balayage n'est pas supprimé", async () => {
  fs.writeFileSync(e1dup2, Buffer.alloc(4096, 9));
  const r = await resolveDuplicateFiles([e1dup2], [media], "admin", later);
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "file_changed");
  assert.ok(fs.existsSync(e1dup2));
});

test("sans dossiers de bibliothèque connus, rien n'est supprimé", async () => {
  const r = await resolveDuplicateFiles([e1dup], [], "admin", later);
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "no_roots");
  assert.ok(fs.existsSync(e1dup));
});

test("un doublon et un fichier sans original se suppriment ; l'original reste, le rapport se met à jour", async () => {
  const r = await resolveDuplicateFiles([e1dup, e2orphan], [media], "admin", later);
  assert.deepEqual(r.failed, []);
  assert.equal(r.done.length, 2);
  assert.equal(r.freedBytes, 2048);
  assert.ok(!fs.existsSync(e1dup) && !fs.existsSync(e2orphan));
  assert.ok(fs.existsSync(e1) && fs.existsSync(e3) && fs.existsSync(e3used));
  const left = loadDuplicateReport().items.map((i) => i.name).sort();
  assert.deepEqual(left, ["Serie - S01E01 (6).mkv", "Serie - S01E03 (2).mkv"]);
});

test("un fichier déjà disparu sort du rapport sans erreur", async () => {
  fs.rmSync(e1dup2);
  const r = await resolveDuplicateFiles([e1dup2], [media], "admin", later);
  assert.equal(r.failed.length, 0);
  assert.equal(r.done.length, 1);
  assert.equal(r.freedBytes, 0);
});

test("une année « (2026) » n'est pas un compteur de doublon, « (2025) (2) » en est un", async () => {
  const { stripCollisionSuffix } = await import("@/lib/library/applyImportedFiles");
  assert.equal(stripCollisionSuffix("Film (2026).mkv", path.posix), "Film (2026).mkv");
  assert.equal(stripCollisionSuffix("Film (1998).mkv", path.posix), "Film (1998).mkv");
  assert.equal(stripCollisionSuffix("Film (2025) (2).mkv", path.posix), "Film (2025).mkv");
  assert.equal(stripCollisionSuffix("Série - S01E01 (12).mkv", path.posix), "Série - S01E01.mkv");
});
