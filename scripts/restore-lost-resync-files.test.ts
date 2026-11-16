import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-restore-lost-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
const snapshots = path.join(config, "repair-snapshots");
fs.mkdirSync(snapshots, { recursive: true });

const { addSeries, getSeries, updateSeries } = await import("../src/lib/library/store.ts");
const { restoreLostResyncFiles } = await import("../src/lib/library/restoreLostResyncFiles.ts");

const media = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-restore-media-"));
const file = (show: string, n: number) => path.join(media, show, "Saison 1", `${show} - S01E0${n}.mkv`);
const write = (p: string, content: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
const ep = (e: number, p: string | null, extra = {}) => ({
  seasonNumber: 1, episodeNumber: e, title: `Titre ${e}`, airDate: "2020-01-01", monitored: true, status: p ? "available" as const : "missing" as const,
  file: p ? { path: p, quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: fs.existsSync(p) ? fs.statSync(p).size : 77, addedAt: 1 } : null,
  activeInfoHash: null, plexRatingKey: p ? `plex-${e}` : null, ...extra,
});
const make = (id: string, tmdbId: number, title: string, episodes: unknown[], extra = {}) => addSeries({
  id, tmdbId, imdbId: null, title, year: 2020, releaseDate: "2020-01-01", overview: "", posterPath: null, backdropPath: null, rating: 0, genres: ["Animation"],
  isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: "show-1",
  seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes }], ...extra,
} as never);
const snapshot = (id: string, at: number, series: unknown, plan: unknown = { duplicates: [] }) =>
  fs.writeFileSync(path.join(snapshots, `anime-resync-${id}-${at}.json`), JSON.stringify({ series, plan, createdAt: at }));
const linked = (id: string) => getSeries(id)!.seasons.flatMap((s) => s.episodes).filter((e) => e.file).map((e) => `${e.episodeNumber}:${path.basename(e.file!.path)}`);

test("files a resync detached are linked again from the snapshot taken just before; a renamed file keeps today's name, a new arrival stays", () => {
  // Before the damage: episodes 1–5 linked, TMDb numbering.
  for (let n = 1; n <= 5; n++) write(file("Lost", n), `lost-${n}-${"x".repeat(n)}`);
  make("sr_lost", 7001, "Lost", [1, 2, 3, 4, 5, 6].map((n) => ep(n, n <= 5 ? file("Lost", n) : null)));
  snapshot("sr_lost", 1000, getSeries("sr_lost"));
  // After it: only episode 1 still linked — and renamed since; episode 6 received a new file; marked TVDB.
  const renamed = path.join(media, "Lost", "Saison 1", "Lost - S01E01 - Nouveau nom.mkv");
  fs.renameSync(file("Lost", 1), renamed);
  write(file("Lost", 6), "brand-new-episode-6");
  updateSeries("sr_lost", { episodeOrder: "tvdb", seasons: [{ seasonNumber: 1, name: "Arc", monitored: true, episodes: [
    { ...ep(1, renamed) }, ep(2, null), ep(3, null), ep(4, null), ep(5, null), ep(6, file("Lost", 6)),
  ] }] } as never);
  assert.equal(linked("sr_lost").length, 2);

  const results = restoreLostResyncFiles(snapshots);
  assert.equal(results.length, 1);
  assert.deepEqual({ ...results[0], snapshot: undefined }, { seriesId: "sr_lost", title: "Lost", snapshot: undefined, relinked: 4, filesBefore: 2, filesAfter: 6 });
  assert.deepEqual(linked("sr_lost"), ["1:Lost - S01E01 - Nouveau nom.mkv", "2:Lost - S01E02.mkv", "3:Lost - S01E03.mkv", "4:Lost - S01E04.mkv", "5:Lost - S01E05.mkv", "6:Lost - S01E06.mkv"]);
  const after = getSeries("sr_lost")!;
  assert.equal(after.episodeOrder, undefined, "the numbering the files carry is back");
  assert.equal(after.plexOrderPending, "tmdb", "and Plex is asked to follow it");
  assert.equal(after.seasons[0].episodes[2].status, "available");
  assert.equal(after.seasons[0].episodes[2].plexRatingKey, "plex-3");
  assert.ok(fs.readdirSync(snapshots).some((n) => n.startsWith("restore-lost-sr_lost-")), "the replaced state is saved first");
  // Running it again finds nothing to do.
  assert.equal(restoreLostResyncFiles(snapshots).length, 0);
});

test("a copy the resync set aside as a duplicate, or a file now linked by another series, is not a lost file", () => {
  for (let n = 1; n <= 3; n++) write(file("Dup", n), `dup-${n}`);
  write(file("Other", 1), "other-1");
  // Snapshot: 3 own files + a duplicate copy on episode 4 + a file that belongs to « Other ».
  const copy = path.join(media, "Dup", "Saison 1", "Dup - S01E02 (doublon).mkv");
  write(copy, "dup-2-copy");
  make("sr_dup2", 7002, "Dup", [ep(1, file("Dup", 1)), ep(2, file("Dup", 2)), ep(3, file("Dup", 3)), ep(4, copy), ep(5, file("Other", 1))]);
  snapshot("sr_dup2", 2000, getSeries("sr_dup2"), { duplicates: [{ seasonNumber: 1, episodeNumber: 2, keptPath: file("Dup", 2), droppedPath: copy, verified: false }] });
  make("sr_other", 7003, "Other", [ep(1, file("Other", 1))]);
  // After the resync: the 3 own files only — exactly what it meant to do.
  updateSeries("sr_dup2", { seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [ep(1, file("Dup", 1)), ep(2, file("Dup", 2)), ep(3, file("Dup", 3))] }] } as never);
  assert.equal(restoreLostResyncFiles(snapshots).length, 0);
  assert.equal(linked("sr_dup2").length, 3);
});

test("a file that no longer exists on disk is never « restored »: nothing to do for that series", () => {
  write(file("Gone", 1), "gone-1");
  make("sr_gone2", 7004, "Gone", [ep(1, file("Gone", 1)), ep(2, path.join(media, "Gone", "Saison 1", "Gone - S01E02.mkv"))]);
  snapshot("sr_gone2", 3000, getSeries("sr_gone2"));
  updateSeries("sr_gone2", { seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [ep(1, file("Gone", 1)), ep(2, null)] }] } as never);
  assert.equal(restoreLostResyncFiles(snapshots).length, 0);
  assert.equal(linked("sr_gone2").length, 1);
});

test("several snapshots: the most recent one that still holds the lost files is used", () => {
  for (let n = 1; n <= 3; n++) write(file("Multi", n), `multi-${n}`);
  make("sr_multi", 7005, "Multi", [ep(1, file("Multi", 1), { title: "Ancien titre" }), ep(2, file("Multi", 2)), ep(3, file("Multi", 3))]);
  snapshot("sr_multi", 4000, getSeries("sr_multi"));
  updateSeries("sr_multi", { seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [ep(1, file("Multi", 1), { title: "Titre récent" }), ep(2, file("Multi", 2)), ep(3, file("Multi", 3))] }] } as never);
  snapshot("sr_multi", 5000, getSeries("sr_multi"));
  updateSeries("sr_multi", { seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [ep(1, file("Multi", 1)), ep(2, null), ep(3, null)] }] } as never);
  const results = restoreLostResyncFiles(snapshots);
  assert.equal(results.length, 1);
  assert.match(results[0].snapshot, /-5000\.json$/);
  assert.equal(getSeries("sr_multi")!.seasons[0].episodes[0].title, "Titre récent");
  assert.equal(linked("sr_multi").length, 3);
});

test("files only Plex can reach (paths unknown to Movviz) are restored when Plex confirms it still holds the episodes — and only those", async () => {
  const { unlinkedSnapshotPlexKeys } = await import("../src/lib/library/restoreLostResyncFiles.ts");
  // Naruto Shippuden's case: 1 file Movviz reads, 3 known through Plex only.
  write(file("Plexy", 1), "plexy-1");
  const plexPath = (n: number) => `/volume1/plex/Plexy/Saison 1/Plexy - S01E0${n}.mkv`;
  make("sr_plexy", 7006, "Plexy", [ep(1, file("Plexy", 1)), ep(2, plexPath(2)), ep(3, plexPath(3)), ep(4, plexPath(4))]);
  snapshot("sr_plexy", 6000, getSeries("sr_plexy"));
  updateSeries("sr_plexy", { seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [ep(1, file("Plexy", 1)), ep(2, null), ep(3, null), ep(4, null)] }] } as never);

  assert.deepEqual(unlinkedSnapshotPlexKeys(snapshots).filter((k) => ["plex-2", "plex-3", "plex-4"].includes(k)).sort(), ["plex-2", "plex-3", "plex-4"]);
  // Without Plex's word, nothing: a path that cannot be checked is not trusted.
  assert.equal(restoreLostResyncFiles(snapshots).filter((r) => r.seriesId === "sr_plexy").length, 0);
  // Plex still holds episodes 2 and 3; it lost 4.
  const results = restoreLostResyncFiles(snapshots, fs.existsSync, new Set(["plex-2", "plex-3"])).filter((r) => r.seriesId === "sr_plexy");
  assert.equal(results.length, 1);
  assert.equal(results[0].filesAfter, 3);
  const eps = getSeries("sr_plexy")!.seasons[0].episodes;
  assert.deepEqual(eps.map((e) => e.status), ["available", "available", "available", "missing"]);
  assert.equal(eps[1].file!.path, plexPath(2));
  assert.equal(eps[3].file, null);
});
