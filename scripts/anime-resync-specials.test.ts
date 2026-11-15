import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-specials-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const { addSeries, getSeries } = await import("../src/lib/library/store.ts");
const { restoreResyncSpecials } = await import("../src/lib/library/restoreResyncSpecials.ts");
const { planAnimeResync } = await import("../src/lib/library/animeResyncPlan.ts");
import type { LibraryEpisode } from "../src/lib/library/types.ts";

const ep = (s: number, e: number, file: string | null, title = `T${s}x${e}`): LibraryEpisode => ({
  seasonNumber: s, episodeNumber: e, title, airDate: null, monitored: s !== 0, status: file ? "available" : "missing",
  file: file ? { path: file, quality: "WEB", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null, size: 1, addedAt: 1 } : null,
  activeInfoHash: null, plexRatingKey: null,
});
const base = { imdbId: null, year: 2015, releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0, genres: [], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null };

test("season 0 removed by the v1.28.147 resync comes back from the oldest snapshot, files included", () => {
  const dir = path.join(config, "repair-snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const original = { ...base, id: "sr_a", tmdbId: 1, title: "A", seasons: [
    { seasonNumber: 0, name: "Spéciaux", monitored: false, episodes: [ep(0, 1, "/m/A/Specials/A - S00E01.mkv", "OVA"), ep(0, 2, null, "Récap")] },
    { seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 1, "/m/A/S1/A - S01E01.mkv")] },
  ] };
  const later = { ...original, seasons: [original.seasons[1], { seasonNumber: 2, name: "S2", monitored: true, episodes: [] }] };
  fs.writeFileSync(path.join(dir, "anime-resync-sr_a-1000.json"), JSON.stringify({ series: original }));
  fs.writeFileSync(path.join(dir, "anime-resync-sr_a-2000.json"), JSON.stringify({ series: later }));
  addSeries({ ...later } as never);
  // A series that still has its season 0 is never touched.
  addSeries({ ...base, id: "sr_b", tmdbId: 2, title: "B", seasons: [{ seasonNumber: 0, name: "Sp", monitored: false, episodes: [ep(0, 1, null)] }] } as never);
  fs.writeFileSync(path.join(dir, "anime-resync-sr_b-1000.json"), JSON.stringify({ series: { ...base, id: "sr_b", seasons: [{ seasonNumber: 0, name: "Old", monitored: false, episodes: [ep(0, 1, null), ep(0, 2, null)] }] } }));

  assert.deepEqual(restoreResyncSpecials(dir), { series: 1, episodes: 2 });
  const a = getSeries("sr_a")!;
  assert.deepEqual(a.seasons.map((s) => s.seasonNumber), [0, 1, 2]);
  assert.equal(a.seasons[0].episodes[0].title, "OVA");
  assert.equal(a.seasons[0].episodes[0].file!.path, "/m/A/Specials/A - S00E01.mkv");
  assert.equal(getSeries("sr_b")!.seasons[0].episodes.length, 1);
  assert.deepEqual(restoreResyncSpecials(dir), { series: 0, episodes: 0 }, "idempotent");
});

test("specials off: a season-0 file is never left behind by the planner", () => {
  const day = (n: number) => new Date(Date.UTC(2010, 0, 1) + n * 7 * 86_400_000).toISOString().slice(0, 10);
  const cat = (sizes: number[]) => sizes.flatMap((n, si) => Array.from({ length: n }, (_, i) => ({ seasonNumber: si + 1, episodeNumber: i + 1, title: "x", airDate: day(sizes.slice(0, si).reduce((a, b) => a + b, 0) + i) })));
  const plan = planAnimeResync({
    oldSeasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: Array.from({ length: 4 }, (_, i) => ({ ...ep(1, i + 1, null), airDate: day(i) })) }],
    tvdb: cat([2, 2]), tmdb: cat([4]), tvdbSeasonNames: new Map(), tmdbSeasonNames: new Map(),
    files: [{ path: "/m/X/Specials/X - S00E01.mkv", literal: { seasonNumber: 0, episodeNumber: 1 }, size: 1, diskFile: ep(0, 1, "/m/X/Specials/X - S00E01.mkv").file! }],
    includeSpecials: false, isCjk: () => false, statusFor: (eps) => new Map(eps.map((e) => [e.episodeNumber, "missing" as const])),
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.seasons.find((s) => s.seasonNumber === 0)?.episodes[0].file?.path, "/m/X/Specials/X - S00E01.mkv");
});
