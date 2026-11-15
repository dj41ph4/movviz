import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-resync-cfg-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const { renameResyncedFiles } = await import("../src/lib/library/resyncRename.ts");
const { matchPlexEpisodesToLibrary } = await import("../src/lib/plex/librarySync.ts");
const { plexOrderingValues, pickPlexOrdering } = await import("../src/lib/plex/client.ts");
import type { LibraryEpisode, LibrarySeason, LibrarySeries } from "../src/lib/library/types.ts";

function show(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "movviz-resync-show-"));
}
function touch(file: string, content = "x") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function ep(s: number, e: number, file: string | null): LibraryEpisode {
  return {
    seasonNumber: s, episodeNumber: e, title: `Titre ${s}x${e}`, airDate: null, monitored: true, status: file ? "available" : "missing",
    file: file ? { path: file, quality: "WEB 1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: 1, addedAt: 1 } : null,
    activeInfoHash: null, plexRatingKey: null,
  };
}
const series = { id: "sr_t", tmdbId: 1, title: "Show", year: 2005, seasons: [] } as unknown as LibrarySeries;
const names = (dir: string) => fs.readdirSync(dir, { recursive: true }).map(String).map((p) => p.replace(/\\/g, "/")).sort();

test("moved files get their new number, in two steps: a renumbering chain never collides", async () => {
  const root = show();
  const f = (n: number) => path.join(root, "Saison 1", `Show - S01E${String(n).padStart(2, "0")}.mkv`);
  for (const n of [9, 10, 11]) touch(f(n), `ep${n}`);
  touch(f(9).replace(".mkv", ".fr.srt"), "sub9");
  // The resync found that file 9 is episode 10, file 10 is 11, file 11 is 12.
  const seasons: LibrarySeason[] = [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 10, f(9)), ep(1, 11, f(10)), ep(1, 12, f(11))] }];
  const result = await renameResyncedFiles(series, seasons, new Set(["1-10", "1-11", "1-12"]));
  assert.equal(result.renamed, 3);
  assert.equal(result.kept, 0);
  const s1 = path.join(root, "Saison 1");
  assert.equal(fs.readFileSync(result.seasons[0].episodes[0].file!.path, "utf8"), "ep9");
  assert.match(result.seasons[0].episodes[0].file!.path, /S01E10/);
  assert.equal(fs.readFileSync(result.seasons[0].episodes[2].file!.path, "utf8"), "ep11");
  assert.ok(fs.readdirSync(s1).some((n) => /S01E10.*\.fr\.srt$/.test(n)), "subtitle follows its video");
  assert.ok(!names(root).some((n) => n.endsWith(".movviz-resync-tmp")));
});

test("a target held by a file outside the batch is never overwritten", async () => {
  const root = show();
  const src = path.join(root, "Saison 1", "Show - S01E15.mkv");
  touch(src, "moved");
  const before = names(root);
  const seasons: LibrarySeason[] = [{ seasonNumber: 2, name: "S2", monitored: true, episodes: [ep(2, 1, src)] }];
  // Pre-create whatever the template renders for S02E01 by renaming once in a dry folder.
  const probeRoot = show();
  touch(path.join(probeRoot, "Saison 1", "Show - S01E15.mkv"));
  const probe = await renameResyncedFiles(series, [{ ...seasons[0], episodes: [ep(2, 1, path.join(probeRoot, "Saison 1", "Show - S01E15.mkv"))] }], new Set(["2-1"]));
  const target = probe.seasons[0].episodes[0].file!.path.replace(probeRoot, root);
  touch(target, "someone else");
  const result = await renameResyncedFiles(series, seasons, new Set(["2-1"]));
  assert.equal(result.renamed, 0);
  assert.equal(result.kept, 1);
  assert.equal(fs.readFileSync(src, "utf8"), "moved");
  assert.equal(fs.readFileSync(target, "utf8"), "someone else");
  assert.equal(result.seasons[0].episodes[0].file!.path, src);
  assert.deepEqual(names(root).filter((n) => !before.includes(n)).length, names(root).length - before.length);
});

// Saint Seiya, 2026-11-15: an unlinked copy sat on « S01E51 »; the file that
// had to take that name stayed « S01E55 », and so did every file behind it.
async function chainWithStray(aside: boolean) {
  const root = show();
  // The names the template gives episodes 51, 55, 59 and 63, found with a dry run elsewhere.
  const dry = show();
  const seed = (n: number) => path.join(dry, "Saison 1", `Show - S01E0${n - 50}.mkv`);
  for (const n of [51, 55, 59, 63]) touch(seed(n));
  const probe = await renameResyncedFiles(series, [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [51, 55, 59, 63].map((n) => ep(1, n, seed(n))) }], new Set(["1-51", "1-55", "1-59", "1-63"]));
  const named = new Map([51, 55, 59, 63].map((n, i) => [n, probe.seasons[0].episodes[i].file!.path.replace(dry, root)]));
  const f = (n: number) => named.get(n)!;
  for (const n of [55, 59, 63]) touch(f(n), `file${n}`);
  const stray = f(51);
  touch(stray, "unlinked copy");
  touch(stray.replace(/.mkv$/, ".fr.srt"), "copy sub");
  // Episode 51's file is the one named 55, 55's is named 59, 59's is named 63.
  const eps = [ep(1, 51, f(55)), ep(1, 55, f(59)), ep(1, 59, f(63))];
  eps[0].title = "Titre 1x51"; eps[1].title = "Titre 1x55"; eps[2].title = "Titre 1x59";
  const seasons: LibrarySeason[] = [{ seasonNumber: 1, name: "S1", monitored: true, episodes: eps }];
  const result = await renameResyncedFiles(series, seasons, new Set(["1-51", "1-55", "1-59"]), () => {}, aside ? new Set([stray]) : new Set());
  return { root, f, stray, result };
}

test("a name held by a foreign file blocks the whole chain behind it — decided before touching the disk", async () => {
  const { root, f, stray, result } = await chainWithStray(false);
  assert.equal(result.renamed, 0);
  assert.equal(result.kept, 3);
  for (const n of [55, 59, 63]) assert.equal(fs.readFileSync(f(n), "utf8"), `file${n}`);
  assert.equal(fs.readFileSync(stray, "utf8"), "unlinked copy");
  assert.deepEqual(result.seasons[0].episodes.map((e) => e.file!.path), [f(55), f(59), f(63)]);
  assert.ok(!names(root).some((n) => n.endsWith(".movviz-resync-tmp")));
});

test("a known unlinked duplicate on the wanted name steps aside (kept, with its subtitle): the chain completes", async () => {
  const { root, f, stray, result } = await chainWithStray(true);
  assert.equal(result.renamed, 3);
  assert.equal(result.kept, 0);
  const paths = result.seasons[0].episodes.map((e) => e.file!.path);
  assert.equal(paths[0], stray, "episode 51's file now holds the name the copy had");
  assert.deepEqual(paths.map((p) => fs.readFileSync(p, "utf8")), ["file55", "file59", "file63"]);
  assert.equal(paths[1], f(55));
  assert.equal(paths[2], f(59));
  const aside = stray.replace(/.mkv$/, " (doublon).mkv");
  assert.equal(fs.readFileSync(aside, "utf8"), "unlinked copy");
  assert.equal(fs.readFileSync(aside.replace(/.mkv$/, ".fr.srt"), "utf8"), "copy sub");
  assert.ok(!names(root).some((n) => n.endsWith(".movviz-resync-tmp")));
});

test("a file moved to a new season lands in that season's existing folder", async () => {
  const root = show();
  const src = path.join(root, "Saison 1", "Show - S01E15.mkv");
  touch(src); touch(path.join(root, "Saison 2", "Show - S02E02.mkv"));
  const r = await renameResyncedFiles(series, [{ seasonNumber: 2, name: "S2", monitored: true, episodes: [ep(2, 1, src)] }], new Set(["2-1"]));
  assert.equal(r.renamed, 1);
  assert.equal(path.basename(path.dirname(r.seasons[0].episodes[0].file!.path)), "Saison 2");
});

test("only episodes that changed file are touched; numberless names are left alone", async () => {
  const root = show();
  const stay = path.join(root, "Saison 1", "Show - S01E03.mkv");
  const free = path.join(root, "Saison 1", "Show 1050.mkv");
  touch(stay); touch(free);
  const seasons: LibrarySeason[] = [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 4, stay), ep(1, 5, free)] }];
  const result = await renameResyncedFiles(series, seasons, new Set(["1-5"]));
  assert.equal(result.renamed, 0);
  assert.ok(fs.existsSync(stay) && fs.existsSync(free));
});

test("Plex items follow the file, whatever number Plex gives it", () => {
  const seasons: LibrarySeason[] = [
    { seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 14, "/data/anime/DBS/Saison 1/DBS - S01E14.mkv")] },
    { seasonNumber: 2, name: "S2", monitored: true, episodes: [ep(2, 1, "/data/anime/DBS/Saison 1/DBS - S01E15.mkv"), ep(2, 2, null)] },
  ];
  const plex = [
    { seasonNumber: 1, episodeNumber: 14, ratingKey: "a", file: { path: "/volume1/media/anime/DBS/Saison 1/DBS - S01E14.mkv" } },
    { seasonNumber: 1, episodeNumber: 15, ratingKey: "b", file: { path: "/volume1/media/anime/DBS/Saison 1/DBS - S01E15.mkv" } },
    { seasonNumber: 2, episodeNumber: 1, ratingKey: "c", file: { path: "/volume1/media/anime/DBS/Saison 2/DBS - S02E01.mkv" } },
    { seasonNumber: 2, episodeNumber: 2, ratingKey: "d", file: { path: "/volume1/media/anime/DBS/Saison 2/DBS - S02E02.mkv" } },
  ];
  const map = matchPlexEpisodesToLibrary(seasons, plex, []);
  assert.equal(map.get("1-14")?.ratingKey, "a");
  assert.equal(map.get("2-1")?.ratingKey, "b", "S2E1 is the file Plex calls S1E15");
  assert.equal(map.get("2-2")?.ratingKey, "d", "an episode without a file still takes the Plex item at its number");
});

test("a Plex item already claimed by another episode's file is never reused by number", () => {
  const seasons: LibrarySeason[] = [
    { seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 1, "/data/x/Saison 1/X - S01E02.mkv"), ep(1, 2, "/data/x/Saison 1/X - S01E02 v2.mkv")] },
  ];
  const plex = [{ seasonNumber: 1, episodeNumber: 2, ratingKey: "two", file: { path: "/p/x/Saison 1/X - S01E02.mkv" } }];
  const map = matchPlexEpisodesToLibrary(seasons, plex, []);
  assert.equal(map.get("1-1")?.ratingKey, "two");
  assert.equal(map.get("1-2"), undefined);
});

test("a second version Plex doesn't list keeps the Plex item at its number, as before", () => {
  const seasons: LibrarySeason[] = [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 3, "/data/x/Saison 1/X - S01E03 VOSTFR.mkv")] }];
  const plex = [{ seasonNumber: 1, episodeNumber: 3, ratingKey: "three", file: { path: "/p/x/Saison 1/X - S01E03 VF.mkv" } }];
  assert.equal(matchPlexEpisodesToLibrary(seasons, plex, []).get("1-3")?.ratingKey, "three");
});

test("Plex episode order: only a value the server declares is ever written", () => {
  const modern = plexOrderingValues({ enumValues: ":Library default|tmdbAiring:The Movie Database (Aired)|tvdbAiring:TheTVDB (Aired)|tvdbDvd:TheTVDB (DVD)|tvdbAbsolute:TheTVDB (Absolute)" });
  assert.equal(pickPlexOrdering(modern, "tvdb"), "tvdbAiring");
  assert.equal(pickPlexOrdering(modern, "tmdb"), "tmdbAiring");
  const legacy = plexOrderingValues({ enumValues: "aired:TheTVDB (Aired)|dvd:TheTVDB (DVD)|absolute:TheTVDB (Absolute)" });
  assert.equal(pickPlexOrdering(legacy, "tvdb"), "aired");
  assert.equal(pickPlexOrdering(legacy, "tmdb"), null);
  assert.equal(pickPlexOrdering(plexOrderingValues(undefined), "tvdb"), null);
});
