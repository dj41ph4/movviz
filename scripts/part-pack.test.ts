import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRelease } from "@/lib/naming/parser";
import { seasonEpisodeMatches, partPackInfo, partPackEpisodeRange } from "@/lib/library/matching";
import type { ReleaseInfo } from "@/lib/naming/types";

/** Minimal ReleaseInfo for matching tests — only season/episode/part fields matter here. */
function rel(partial: Partial<Pick<ReleaseInfo, "season" | "episode" | "seasonPart">>): ReleaseInfo {
  return {
    title: "X",
    year: null,
    season: null,
    episode: null,
    episodeTitle: null,
    resolution: null,
    source: null,
    videoCodec: null,
    audioCodec: null,
    hdr: null,
    language: null,
    group: null,
    ...partial,
  };
}

// ── Season-split parsing (DVD ordering) ──────────────────────────────────

test("S02 plain release (DVD part 2) parses season 2 without part marker", () => {
  const parsed = parseRelease("Disjointed.S02.FRENCH.1080p.WEBRip.x264.EAC3.5.1-Floppy");
  assert.equal(parsed.season, 2);
  assert.equal(parsed.episode, null);
  assert.equal(parsed.seasonPart, null);
  assert.equal(parsed.title, "Disjointed");
});

test("S01.PART.01 parses season 1 with part 1", () => {
  const parsed = parseRelease("Disjointed.S01.PART.01.MULTI.VFF.1080p.WEBRip.EAC3.5.1.x264-TiMELiNE");
  assert.equal(parsed.season, 1);
  assert.equal(parsed.seasonPart, 1);
  assert.equal(parsed.title, "Disjointed");
});

test("S02.S01.PART.02 parses season 2 with part 2", () => {
  const parsed = parseRelease("Disjointed.S02.S01.PART.02.MULTI.VFF.1080p.WEBRip.EAC3.5.1.x264-MrS");
  assert.equal(parsed.season, 2);
  assert.equal(parsed.seasonPart, 2);
  assert.equal(parsed.title, "Disjointed");
});

test("spelled-out Part 2 marker is recognized", () => {
  const parsed = parseRelease("Some.Show.S01.Part.2.1080p.WEB-DL");
  assert.equal(parsed.season, 1);
  assert.equal(parsed.seasonPart, 2);
});

test("'Party' / 'Departure' never parse as a part marker", () => {
  assert.equal(parseRelease("Crazy.Party.2020.MULTI.1080p.WEB-DL").seasonPart, null);
  assert.equal(parseRelease("My.Departure.S01E01.1080p.WEB-DL").seasonPart, null);
});

// ── partPackEpisodeRange ─────────────────────────────────────────────────

test("part 2 of a 20-episode season covers episodes 11-20", () => {
  assert.deepEqual(partPackEpisodeRange(20, 2), { start: 11, end: 20 });
});

test("part 1 of a 2-part 10-episode season covers episodes 1-5", () => {
  assert.deepEqual(partPackEpisodeRange(10, 2), { start: 6, end: 10 });
  assert.deepEqual(partPackEpisodeRange(10, 1), { start: 1, end: 10 });
});

test("odd total gives the extra episode to the first part (part 2 starts at 12)", () => {
  assert.deepEqual(partPackEpisodeRange(21, 2), { start: 12, end: 21 });
});

// ── partPackInfo ─────────────────────────────────────────────────────────

const singleSeasonSeries = { seasons: [{ episodes: Array.from({ length: 20 }, () => ({})) }] };
const multiSeasonSeries = {
  seasons: [
    { episodes: Array.from({ length: 20 }, () => ({})) },
    { episodes: Array.from({ length: 10 }, () => ({})) },
  ],
};

test("S02 release of a single-season series resolves to part 2 (partSize 10)", () => {
  const info = partPackInfo(singleSeasonSeries, rel({ season: 2 }));
  assert.deepEqual(info, { partNumber: 2, partSize: 10 });
});

test("explicit part marker wins over the season number (S01.PART.02)", () => {
  const info = partPackInfo(singleSeasonSeries, rel({ season: 1, seasonPart: 2 }));
  assert.deepEqual(info, { partNumber: 2, partSize: 10 });
});

test("multi-season series never resolve to a part", () => {
  assert.equal(partPackInfo(multiSeasonSeries, rel({ season: 2 })), null);
  assert.equal(partPackInfo(multiSeasonSeries, rel({ season: 2, seasonPart: 2 })), null);
});

test("season 1 of a single-season series is not a part", () => {
  assert.equal(partPackInfo(singleSeasonSeries, rel({ season: 1 })), null);
});

// ── seasonEpisodeMatches with single-season context ──────────────────────

const t20 = 20;

test("S02 pack matches a season-1 single-episode target inside the part range (E12)", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 1, 12, t20), true);
});

test("S02 pack does not match a season-1 episode outside the part range (E5)", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 1, 5, t20), false);
});

test("S02 pack matches a season-1 pack search", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 1, null, t20), true);
});

test("S01.PART.02 matches season-1 episode E12 via the part marker", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 1, seasonPart: 2 }), 1, 12, t20), true);
});

test("without single-season context the part fallback never applies", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 1, 12, null), false);
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 1, null, null), false);
  assert.equal(seasonEpisodeMatches(rel({ season: 1, seasonPart: 2 }), 1, 12, null), false);
});

test("normal matching is unchanged", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 1, episode: 12 }), 1, 12, t20), true);
  assert.equal(seasonEpisodeMatches(rel({ season: 1, episode: 13 }), 1, 12, t20), false);
  assert.equal(seasonEpisodeMatches(rel({ season: 2, episode: 5 }), 2, 5, t20), true);
  assert.equal(seasonEpisodeMatches(rel({ season: 1 }), 1, null, t20), true);
  assert.equal(seasonEpisodeMatches(rel({}), 1, null, t20), true);
});

test("a real season-2 pack of a single-season series matches its own season", () => {
  assert.equal(seasonEpisodeMatches(rel({ season: 2 }), 2, null, t20), true);
  assert.equal(seasonEpisodeMatches(rel({ season: 2, episode: 4 }), 2, 4, t20), true);
});
