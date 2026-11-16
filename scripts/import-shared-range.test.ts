import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-shared-range-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
// No engine, no Plex, no TMDb in this test.
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; });

const { dropSharedRanges, fileForEpisode, applyImportedFiles } = await import("../src/lib/library/applyImportedFiles.ts");
const { addSeries, getSeries } = await import("../src/lib/library/store.ts");

const f = (episode: number | null, episodeEnd: number | null, name = `E${episode}`) => ({ path: `/x/${name}.mkv`, season: 1, episode, episodeEnd, quality: null, resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null, size: 1 });

test("a range carried by several files of one import is the release's: dropped", () => {
  const files = [f(10, 19, "a"), f(10, 19, "b"), f(10, 19, "c"), f(4, 5, "double")];
  const out = dropSharedRanges(files);
  assert.deepEqual(out.map((x) => x.episodeEnd), [null, null, null, 5], "a real double episode (one file) keeps its range");
});

test("the file numbered like the episode wins over a range that also covers it", () => {
  const files = [f(1, 11, "pack-first"), f(4, null, "own-4")];
  assert.equal(fileForEpisode(files, 4)?.path, "/x/own-4.mkv");
  assert.equal(fileForEpisode(files, 5)?.path, "/x/pack-first.mkv", "the range still serves an episode nobody else claims");
  assert.equal(fileForEpisode(files, 12), undefined);
});

test("season pack whose files all carried the release range: each episode gets at most its own file, never the first one for all", async () => {
  const media = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-shared-media-"));
  const p = (n: number) => path.join(media, "Show", "Saison 1", `Show - S01E${String(n).padStart(2, "0")}.mkv`);
  for (const n of [10, 11, 12]) { fs.mkdirSync(path.dirname(p(n)), { recursive: true }); fs.writeFileSync(p(n), `ep${n}`); }
  addSeries({
    id: "sr_range", tmdbId: 880099, imdbId: null, title: "Show", year: 2020, releaseDate: "2020-01-01", overview: "", posterPath: null, backdropPath: null,
    rating: 0, genres: [], tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null,
    seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: Array.from({ length: 19 }, (_, i) => ({
      seasonNumber: 1, episodeNumber: i + 1, title: `T${i + 1}`, airDate: "2020-01-01", monitored: true,
      status: i + 1 >= 10 ? "downloading" as const : "missing" as const, file: null, activeInfoHash: i + 1 >= 10 ? "hash-pack" : null, plexRatingKey: null,
    })) }],
  } as never);
  // What the engine used to send: the moved files, each stamped with the release's range S01E10-E19,
  // the first one renamed after E10 and the next ones after the episode the engine matched.
  const files = [10, 11, 12].map((n, i) => ({ path: p(n), season: 1, episode: i === 0 ? 10 : n, episodeEnd: 19, quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size: 4 }));
  // The worst form of it: every file says « 10-19 ».
  const worst = files.map((x) => ({ ...x, episode: 10 }));
  await applyImportedFiles({ kind: "season", seriesId: "sr_range", season: 1 }, worst, "hash-pack");
  const eps = getSeries("sr_range")!.seasons[0].episodes;
  const linked = eps.filter((e) => e.file).map((e) => `${e.episodeNumber}:${path.basename(e.file!.path)}`);
  assert.deepEqual(linked, ["10:Show - S01E10.mkv"], "only the one episode the files can prove; never E11-E19 on the E10 file");
  for (const n of [13, 14, 19]) assert.equal(eps[n - 1].file, null);
  const distinct = new Set(eps.filter((e) => e.file).map((e) => e.file!.path));
  assert.equal(distinct.size, eps.filter((e) => e.file).length, "no file linked to two episodes");
});
