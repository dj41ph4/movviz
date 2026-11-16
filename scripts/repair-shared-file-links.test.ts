import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-shared-links-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
const { repairSharedFileLinks } = await import("../src/lib/library/repairSharedFileLinks.ts");
const { getSeries, addSeries } = await import("../src/lib/library/store.ts");

const file = (name: string) => ({ path: `/data/série/X/Saison 1/${name}`, quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: 1, addedAt: 1 });
const ep = (s: number, e: number, name: string | null, extra = {}) => ({
  seasonNumber: s, episodeNumber: e, title: `T${e}`, airDate: "2020-01-01", monitored: true, status: name ? "available" as const : "missing" as const,
  file: name ? file(name) : null, activeInfoHash: null, plexRatingKey: null, playbackSource: name ? "movviz" as const : null, ...extra,
});
const make = (id: string, episodes: unknown[]) => addSeries({
  id, tmdbId: Math.floor(Math.random() * 1e9), imdbId: null, title: id, year: 2020, releaseDate: "2020-01-01", overview: "", posterPath: null, backdropPath: null,
  rating: 0, genres: [], tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null,
  seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes }],
} as never);
const linked = (id: string) => getSeries(id)!.seasons[0].episodes.map((e) => `${e.episodeNumber}:${e.status}:${e.file ? path.basename(e.file.path) : "-"}`);

test("The Beast pattern: the E01 file wrongly linked to E04-E06 is taken back from them, E01 keeps it, E02 keeps its own", () => {
  make("beast", [
    ep(1, 1, "The Beast - S01E01.mkv", { plexRatingKey: "p1" }),
    ep(1, 2, "The Beast - S01E02.mkv"),
    ep(1, 3, null),
    ep(1, 4, "The Beast - S01E01.mkv"), ep(1, 5, "The Beast - S01E01.mkv"), ep(1, 6, "The Beast - S01E01.mkv"),
  ]);
  const r = repairSharedFileLinks(undefined, path.join(config, "snaps"));
  assert.deepEqual(r.find((x) => x.seriesId === "beast")?.detached, ["1-4", "1-5", "1-6"]);
  assert.deepEqual(linked("beast"), ["1:available:The Beast - S01E01.mkv", "2:available:The Beast - S01E02.mkv", "3:missing:-", "4:missing:-", "5:missing:-", "6:missing:-"]);
  assert.ok(fs.readdirSync(path.join(config, "snaps")).some((n) => n.startsWith("shared-links-beast-")), "saved before any change");
});

test("left alone: a link Plex itself made, a declared double episode, a file nobody is named after", () => {
  make("keep", [
    ep(1, 1, "Keep - S02E01.mkv", { plexRatingKey: "pa" }), // Plex links S1E1 and S2E1-named file (other ordering)
    ep(1, 2, "Keep - S02E01.mkv", { plexRatingKey: "pb" }),
    ep(1, 3, "Keep - S01E03-E04.mkv"), ep(1, 4, "Keep - S01E03-E04.mkv"), // real double episode
    ep(1, 5, "Keep - Episode special.mkv"), ep(1, 6, "Keep - Episode special.mkv"), // no number in the name: no proof
    ep(1, 7, "Keep - S01E07.mkv", { combinedFile: { episodes: [7, 8] } }), ep(1, 8, "Keep - S01E07.mkv", { combinedFile: { episodes: [7, 8] } }),
  ]);
  const before = linked("keep");
  const r = repairSharedFileLinks(undefined, path.join(config, "snaps"));
  assert.equal(r.find((x) => x.seriesId === "keep"), undefined);
  assert.deepEqual(linked("keep"), before);
});

test("running it again changes nothing", () => {
  assert.equal(repairSharedFileLinks(undefined, path.join(config, "snaps")).length, 0);
});
