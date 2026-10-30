import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import des stores : jamais la vraie bibliothèque.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-corrupt-resolve-"));
const config = path.join(root, "config");
const media = path.join(root, "media");
fs.mkdirSync(config, { recursive: true });
fs.mkdirSync(media, { recursive: true });
process.env.MOVVIZ_CONFIG_DIR = config;

const { resolveCorruptFiles } = await import("../src/lib/library/corruptFilesResolve.ts");
const { getMovie, getSeries, loadMovies } = await import("../src/lib/library/store.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

after(() => fs.rmSync(root, { recursive: true, force: true }));

const MB = 1024 * 1024;
const bad = (name: string) => {
  const p = path.join(media, name);
  fs.writeFileSync(p, Buffer.alloc(2 * MB));
  return p;
};
const good = (name: string) => {
  const p = path.join(media, name);
  fs.writeFileSync(p, crypto.randomBytes(2 * MB));
  return p;
};
const file = (p: string) => ({ path: p, diskPath: p, quality: "WEB 1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size: 2 * MB, addedAt: 1 });

const movieBad = bad("movie-bad.mkv");
const epBad = bad("ep-bad.mkv");
const epOk = good("ep-ok.mkv");
const movieOk = good("movie-ok.mkv");
const movieDel = bad("movie-del.mkv");
const epDel = bad("ep-del.mkv");
const epNew = bad("ep-new.mkv");
const movieOld = bad("movie-old.mkv");

const movie = (id: string, p: string) => ({
  id, tmdbId: Number(id.replace(/\D/g, "")) || 1, imdbId: null, title: id, year: 2020, releaseDate: null, vfReleaseDate: null, overview: "",
  posterPath: null, backdropPath: null, rating: 0, runtime: null, genres: [], monitored: false, qualityProfileId: "q", status: "available",
  file: file(p), activeInfoHash: null, addedAt: 1, plexRatingKey: "42", plexMediaInfo: null,
});
const episode = (n: number, p: string | null) => ({
  seasonNumber: 1, episodeNumber: n, title: `E${n}`, airDate: "2020-01-01", monitored: true, status: p ? "available" : "missing",
  file: p ? file(p) : null, activeInfoHash: null, plexRatingKey: p ? "7" : null,
});

fs.writeFileSync(path.join(config, "library-movies.json"), JSON.stringify([movie("mv_bad", movieBad), movie("mv_ok", movieOk), movie("mv_del", movieDel), movie("mv_old", movieOld)]));
fs.writeFileSync(
  path.join(config, "library-series.json"),
  JSON.stringify([{
    id: "sr_1", tmdbId: 9, title: "Serie", year: 2020, overview: "", posterPath: null, backdropPath: null, rating: 0, monitored: true,
    seasons: [{ seasonNumber: 1, monitored: true, episodes: [episode(1, epBad), episode(2, epOk), episode(3, epDel), episode(4, epNew)] }],
  }])
);

const reportItem = (over: Record<string, unknown>) => {
  const st = fs.statSync(over.path as string);
  return { size: st.size, mtimeMs: st.mtimeMs, reason: "zero_head", zeroRatio: 1, ...over };
};
fs.writeFileSync(
  path.join(config, "corrupt-files.json"),
  JSON.stringify({
    scannedAt: 1, checked: 4, missing: 0,
    items: [
      // Rapport d'une ancienne version : pas d'empreinte (mtimeMs).
      { kind: "movie", id: "mv_old", title: "mv_old", path: movieOld, size: 2 * MB, reason: "zero_head", zeroRatio: 1 },
      reportItem({ kind: "episode", id: "sr_1", title: "Serie", seasonNumber: 1, episodeNumber: 4, path: epNew }),
      reportItem({ kind: "movie", id: "mv_del", title: "mv_del", path: movieDel }),
      reportItem({ kind: "episode", id: "sr_1", title: "Serie", seasonNumber: 1, episodeNumber: 3, path: epDel }),
      reportItem({ kind: "movie", id: "mv_bad", title: "mv_bad", path: movieBad }),
      reportItem({ kind: "episode", id: "sr_1", title: "Serie", seasonNumber: 1, episodeNumber: 1, path: epBad }),
      // Déjà sain au moment de l'action : ne doit JAMAIS être supprimé.
      reportItem({ kind: "episode", id: "sr_1", title: "Serie", seasonNumber: 1, episodeNumber: 2, path: epOk }),
    ],
  })
);

// Un nouveau téléchargement arrive au même chemin APRÈS le balayage (le fichier
// corrompu a été remplacé) : il ne doit jamais être supprimé par un clic tardif.
fs.writeFileSync(epNew, crypto.randomBytes(3 * MB));

test("un fichier remplacé depuis le balayage n'est jamais supprimé", async () => {
  const r = await resolveCorruptFiles([{ kind: "episode", id: "sr_1", seasonNumber: 1, episodeNumber: 4 }], "replace", "admin");
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "file_changed");
  assert.ok(fs.existsSync(epNew));
  assert.equal(getSeries("sr_1")?.seasons[0].episodes[3].status, "available");
});

test("un rapport sans empreinte (ancien) impose un nouveau balayage", async () => {
  const r = await resolveCorruptFiles([{ kind: "movie", id: "mv_old" }], "delete", "admin");
  assert.equal(r.failed[0].error, "rescan_needed");
  assert.ok(fs.existsSync(movieOld));
});

test("un fichier hors rapport n'est pas touché", async () => {
  const r = await resolveCorruptFiles([{ kind: "movie", id: "mv_ok" }], "delete", "admin");
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "not_in_report");
  assert.ok(fs.existsSync(movieOk));
});

test("un fichier redevenu sain n'est jamais supprimé", async () => {
  const r = await resolveCorruptFiles([{ kind: "episode", id: "sr_1", seasonNumber: 1, episodeNumber: 2 }], "replace", "admin");
  assert.equal(r.done.length, 0);
  assert.equal(r.failed[0].error, "file_now_healthy");
  assert.ok(fs.existsSync(epOk));
  assert.equal(getSeries("sr_1")?.seasons[0].episodes[1].status, "available");
});

test("remplacer un épisode : fichier effacé, épisode manquant et surveillé, série à rechercher", async () => {
  const r = await resolveCorruptFiles([{ kind: "episode", id: "sr_1", seasonNumber: 1, episodeNumber: 1 }], "replace", "admin");
  assert.equal(r.done.length, 1);
  assert.deepEqual(r.seriesIds, ["sr_1"]);
  assert.ok(!fs.existsSync(epBad));
  const ep = getSeries("sr_1")!.seasons[0].episodes[0];
  assert.equal(ep.status, "missing");
  assert.equal(ep.file, null);
  assert.equal(ep.monitored, true);
  assert.equal(ep.plexRatingKey, null);
});

test("remplacer un film : fichier effacé, film manquant et surveillé, film à rechercher", async () => {
  const r = await resolveCorruptFiles([{ kind: "movie", id: "mv_bad" }], "replace", "admin");
  assert.equal(r.done.length, 1);
  assert.deepEqual(r.movieIds, ["mv_bad"]);
  assert.ok(!fs.existsSync(movieBad));
  const m = getMovie("mv_bad")!;
  assert.equal(m.status, "missing");
  assert.equal(m.file, null);
  assert.equal(m.monitored, true);
  assert.ok(loadMovies().some((x) => x.id === "mv_ok"), "l'autre film reste intact");
  assert.ok(fs.existsSync(movieOk));
  flushPendingJsonWritesSync();
});

test("supprimer seul : fichiers effacés, film retiré, épisode vidé et non surveillé, aucune recherche", async () => {
  const r = await resolveCorruptFiles(
    [{ kind: "movie", id: "mv_del" }, { kind: "episode", id: "sr_1", seasonNumber: 1, episodeNumber: 3 }],
    "delete",
    "admin"
  );
  assert.equal(r.done.length, 2);
  assert.deepEqual(r.movieIds, []);
  assert.deepEqual(r.seriesIds, []);
  assert.ok(!fs.existsSync(movieDel));
  assert.ok(!fs.existsSync(epDel));
  assert.equal(getMovie("mv_del"), null);
  const ep = getSeries("sr_1")!.seasons[0].episodes[2];
  assert.equal(ep.file, null);
  assert.equal(ep.monitored, false);
  flushPendingJsonWritesSync();
});
