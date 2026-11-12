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

test("un fichier fraîchement écrit n'est pas bloqué : il est classé comme les autres", async () => {
  const report = await scanDuplicateFiles([media]);
  assert.ok(report.items.length > 0);
  assert.ok(report.items.every((i) => i.state !== "recent"));
  assert.equal(report.items.find((i) => i.name === "Serie - S01E01 (2).mkv")!.state, "duplicate");
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

test("fusion : le « (n) » utilisé prend le nom de l'original, l'ancien part, la bibliothèque suit", async () => {
  const { mergeDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const { loadSeries } = await import("../src/lib/library/store.ts");
  await scanDuplicateFiles([media], undefined, { now: later });
  // Un fichier non utilisé ne se fusionne pas (il se supprime).
  const refused = await mergeDuplicateFiles([e1dup2], [media], "admin");
  assert.equal(refused.done.length, 0);
  assert.ok(["not_mergeable", "not_in_report", "already_gone"].includes(refused.failed[0].error));
  // L'original est plus ancien que le « (n) » (écrit après) : un fichier récent ne bloque pas.
  fs.utimesSync(e3, new Date(Date.now() - 3600_000), new Date(Date.now() - 3600_000));
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await mergeDuplicateFiles([e3used], [media], "admin");
  assert.equal(r.failed.length, 0);
  assert.equal(r.done.length, 1);
  assert.ok(fs.existsSync(e3), "le nom propre existe");
  assert.ok(!fs.existsSync(e3used), "le « (2) » a disparu");
  assert.ok(!fs.existsSync(`${e3}.movviz-merge-bak`), "plus de sauvegarde");
  const ep = loadSeries()[0].seasons[0].episodes.find((e) => e.episodeNumber === 3)!;
  assert.equal(ep.file!.path, e3);
  assert.equal(ep.file!.diskPath, e3);
  assert.ok(!loadDuplicateReport().items.some((i) => i.path === e3used));
});

test("fusion : l'original plus récent reste, le « (n) » moins récent est supprimé, la bibliothèque suit", async () => {
  const { mergeDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const { loadSeries, updateSeriesList } = await import("../src/lib/library/store.ts");
  const orig = put("Serie - S01E05.mkv", 3000);
  const dup = put("Serie - S01E05 (2).mkv", 2000);
  fs.utimesSync(dup, new Date(Date.now() - 7200_000), new Date(Date.now() - 7200_000)); // le « (n) » est le plus ancien
  const s = loadSeries()[0];
  updateSeriesList(new Map([[s.id, { seasons: s.seasons.map((x) => ({ ...x, episodes: [...x.episodes, episode(5, dup)] })) } as never]]));
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await mergeDuplicateFiles([dup], [media], "admin");
  assert.deepEqual(r.failed, []);
  assert.ok(fs.existsSync(orig) && !fs.existsSync(dup));
  assert.equal(fs.statSync(orig).size, 3000);
  const ep = loadSeries()[0].seasons[0].episodes.find((e) => e.episodeNumber === 5)!;
  assert.equal(ep.file!.path, orig);
  assert.equal(ep.file!.size, 3000);
});

test("liaison : un « (n) » seul, non utilisé, prend le nom propre et se lie à l'épisode sans fichier", async () => {
  const { linkDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const { loadSeries, updateSeriesList } = await import("../src/lib/library/store.ts");
  const lonely = put("Serie - S01E07 (2).mkv", 1500);
  const s = loadSeries()[0];
  const missing = { ...episode(7, path.join(season, "absent.mkv")), file: null, status: "missing" };
  updateSeriesList(new Map([[s.id, { seasons: s.seasons.map((x) => ({ ...x, episodes: [...x.episodes, missing] })) } as never]]));
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await linkDuplicateFiles([lonely], [media], "admin");
  assert.deepEqual(r.failed, []);
  const clean = path.join(season, "Serie - S01E07.mkv");
  assert.ok(fs.existsSync(clean) && !fs.existsSync(lonely));
  const ep = loadSeries()[0].seasons[0].episodes.find((e) => e.episodeNumber === 7)!;
  assert.equal(ep.status, "available");
  assert.equal(ep.file!.path, clean);
  assert.equal(ep.file!.size, 1500);
});

test("liaison : sans cible, le fichier reprend quand même son nom propre (plus de « (n) »)", async () => {
  const { linkDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const stray = put("Inconnu - S09E09 (2).mkv", 900);
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await linkDuplicateFiles([stray], [media], "admin");
  assert.deepEqual(r.failed, []);
  assert.ok(!fs.existsSync(stray) && fs.existsSync(path.join(season, "Inconnu - S09E09.mkv")));
});

test("un « (n) » utilisé sans original reprend le nom propre et la bibliothèque suit", async () => {
  const { linkDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const { loadSeries, updateSeriesList } = await import("../src/lib/library/store.ts");
  const used = put("Serie - S01E08 (2).mkv", 1700);
  const s = loadSeries()[0];
  updateSeriesList(new Map([[s.id, { seasons: s.seasons.map((x) => ({ ...x, episodes: [...x.episodes, episode(8, used)] })) }]]) as never);
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await linkDuplicateFiles([used], [media], "admin");
  assert.deepEqual(r.failed, []);
  const clean = path.join(season, "Serie - S01E08.mkv");
  assert.ok(fs.existsSync(clean) && !fs.existsSync(used));
  assert.equal(loadSeries()[0].seasons[0].episodes.find((e) => e.episodeNumber === 8)!.file!.path, clean);
});

test("deux fichiers non utilisés : le plus récent garde le nom propre, l'autre part", async () => {
  const { mergeDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const orig = put("Libre - S01E01.mkv", 800);
  const dup = put("Libre - S01E01 (2).mkv", 1200);
  fs.utimesSync(orig, new Date(Date.now() - 7200_000), new Date(Date.now() - 7200_000));
  await scanDuplicateFiles([media], undefined, { now: later });
  const r = await mergeDuplicateFiles([dup], [media], "admin");
  assert.deepEqual(r.failed, []);
  assert.ok(fs.existsSync(orig) && !fs.existsSync(dup));
  assert.equal(fs.statSync(orig).size, 1200, "le plus récent (le « (2) ») a pris le nom propre");
});

test("à la fin, plus aucun « (n) » dans le dossier", async () => {
  await scanDuplicateFiles([media], undefined, { now: later });
  const left = loadDuplicateReport().items.map((i) => i.name);
  const { linkDuplicateFiles, mergeDuplicateFiles } = await import("../src/lib/library/duplicateFiles.ts");
  const items = loadDuplicateReport().items;
  await mergeDuplicateFiles(items.filter((i) => i.originalSize !== null).map((i) => i.path), [media], "admin");
  await linkDuplicateFiles(items.filter((i) => i.originalSize === null).map((i) => i.path), [media], "admin");
  const after = await scanDuplicateFiles([media], undefined, { now: later });
  assert.deepEqual(after.items.map((i) => i.name), [], `restait : ${left.join(", ")}`);
});
