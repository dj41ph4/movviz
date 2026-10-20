import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-episode-sync-"));
process.env.MOVVIZ_DATA_DIR = process.env.MOVVIZ_CONFIG_DIR;
const { mergeSeasons } = await import("../src/lib/library/episodeSync.ts");

const file = { path: "/x.mkv" } as never;
const ep = (n: number, extra: Record<string, unknown> = {}) => ({
  seasonNumber: 4, episodeNumber: n, title: `Episode ${n}`, airDate: "2026-08-14", monitored: true,
  status: "available" as const, file, activeInfoHash: null, plexRatingKey: "rk", ...extra,
});
const tmdbEp = (season: number, n: number, airDate: string | null, title = `Épisode ${n}`) => ({
  seasonNumber: season, episodeNumber: n, title, airDate, overview: "", stillPath: null, runtime: null, rating: 0,
});
const series = (seasons: unknown[], monitored = true) => ({ id: "sr_1", tmdbId: 123542, title: "Link Click", monitored, seasons }) as never;

test("missing episodes of an existing season are appended, existing data untouched", () => {
  const result = mergeSeasons(
    series([{ seasonNumber: 4, name: "Saison 4", monitored: true, episodes: [ep(1)] }]),
    [{ seasonNumber: 4, name: "Saison 4", episodeCount: 3, airDate: null, posterPath: null, episodes: [tmdbEp(4, 1, "2026-08-14"), tmdbEp(4, 2, "2026-08-21"), tmdbEp(4, 3, "2099-01-01")] }],
  );
  assert.ok(result);
  assert.equal(result.added, 2);
  const eps = result.seasons[0].episodes;
  assert.deepEqual(eps.map((e) => e.episodeNumber), [1, 2, 3]);
  assert.equal(eps[0].file, file);
  assert.equal(eps[0].status, "available");
  assert.equal(eps[0].plexRatingKey, "rk");
  assert.equal(eps[0].title, "Épisode 1", "title refreshed from TMDb");
  assert.equal(eps[1].status, "missing", "aired episode becomes searchable");
  assert.equal(eps[2].status, "upcoming", "future episode waits for its air date");
  assert.equal(eps[1].monitored, true);
});

test("a new season is added only for a monitored series", () => {
  const tmdb = [
    { seasonNumber: 4, name: "Saison 4", episodeCount: 1, airDate: null, posterPath: null, episodes: [tmdbEp(4, 1, "2026-08-14")] },
    { seasonNumber: 5, name: "Saison 5", episodeCount: 1, airDate: null, posterPath: null, episodes: [tmdbEp(5, 1, "2099-01-01")] },
  ];
  const lib = [{ seasonNumber: 4, name: "Saison 4", monitored: true, episodes: [ep(1, { title: "Épisode 1" })] }];
  assert.equal(mergeSeasons(series(lib, true), tmdb)?.seasons.length, 2);
  assert.equal(mergeSeasons(series(lib, false), tmdb)?.seasons.length, 1);
});

test("incompatible numbering (more episodes than TMDb) is left untouched", () => {
  const result = mergeSeasons(
    series([{ seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, { seasonNumber: 1 }), ep(40, { seasonNumber: 1 })] }]),
    [{ seasonNumber: 1, name: "S1", episodeCount: 2, airDate: null, posterPath: null, episodes: [tmdbEp(1, 1, "2020-01-01"), tmdbEp(1, 2, "2020-01-08")] }],
  );
  assert.equal(result, null);
});

test("nothing changes when the library already matches TMDb", () => {
  const result = mergeSeasons(
    series([{ seasonNumber: 4, name: "Saison 4", monitored: true, episodes: [ep(1, { title: "Épisode 1" })] }]),
    [{ seasonNumber: 4, name: "Saison 4", episodeCount: 1, airDate: null, posterPath: null, episodes: [tmdbEp(4, 1, "2026-08-14")] }],
  );
  assert.equal(result?.changed, false);
});
