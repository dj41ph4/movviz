import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { combinedEpisodeCandidate, combinedEpisodePeers, durationsConfirmCombinedEpisodes, mapCombinedSeason } from "../src/lib/library/combinedEpisodes.ts";
import type { LibraryEpisode, LibrarySeason, LibrarySeries } from "../src/lib/library/types.ts";

function fixture(fileCount = 10, catalogCount = 20, final = false) {
  const episodes = Array.from({ length: catalogCount }, (_, index): LibraryEpisode => {
    const number = index + 1;
    const available = number <= fileCount;
    return {
      seasonNumber: 1, episodeNumber: number, title: `Episode ${number}`, airDate: "2021-01-01",
      monitored: true, status: available ? "available" : "missing", activeInfoHash: null, plexRatingKey: null,
      file: available ? {
        path: path.resolve("fixture", `S01E${String(number).padStart(2, "0")}${final && number === fileCount ? ".FINAL" : ""}.mkv`),
        quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: 400_000_000, addedAt: 1,
      } : null,
    };
  });
  const season: LibrarySeason = { seasonNumber: 1, name: "Season 1", monitored: true, episodes };
  const series = { episodeOrder: "tmdb", isAnime: false, seasons: [season] } as LibrarySeries;
  return { series, season };
}

test("a 10-file/20-episode pack with simple S01E01 names is a candidate", () => {
  const { series, season } = fixture();
  const candidate = combinedEpisodeCandidate(series, season);
  assert.ok(candidate);
  assert.equal(candidate.sources.length, 10);
  assert.equal(candidate.hasFinalMarker, false);
  assert.equal(durationsConfirmCombinedEpisodes(candidate, Array(20).fill(11), Array(10).fill(22 * 60_000)), true);
  assert.equal(durationsConfirmCombinedEpisodes(candidate, Array(20).fill(11), Array(10).fill(11 * 60_000)), false);
});

test("FINAL is optional corroboration, never enough to override normal durations", () => {
  const { series, season } = fixture(10, 20, true);
  const candidate = combinedEpisodeCandidate(series, season);
  assert.ok(candidate);
  assert.equal(candidate.hasFinalMarker, true);
  assert.equal(durationsConfirmCombinedEpisodes(candidate, Array(20).fill(11), Array(10).fill(11 * 60_000)), false);
});

test("mapping exposes all 20 catalog episodes from 10 physical files", () => {
  const { series, season } = fixture();
  const mapped = mapCombinedSeason(season, combinedEpisodeCandidate(series, season)!);
  assert.equal(mapped.doubleEpisodesMode, "auto");
  assert.equal(mapped.episodes.filter((episode) => episode.status === "available").length, 20);
  for (let i = 0; i < 10; i++) {
    assert.equal(mapped.episodes[2 * i].file?.path, season.episodes[i].file?.path);
    assert.equal(mapped.episodes[2 * i + 1].file?.path, season.episodes[i].file?.path);
    assert.equal(mapped.episodes[2 * i + 1].episodeNumber, 2 * i + 2);
  }
});

test("partial, active and independently available seasons stay unmapped", () => {
  const partial = fixture(10, 22);
  assert.equal(combinedEpisodeCandidate(partial.series, partial.season), null);
  const active = fixture();
  active.season.episodes[15].status = "downloading";
  assert.equal(combinedEpisodeCandidate(active.series, active.season), null);
  const separate = fixture();
  separate.season.episodes[15].file = separate.season.episodes[0].file;
  assert.equal(combinedEpisodeCandidate(separate.series, separate.season), null);
});

test("only an intact pair sharing one path is treated as one episode file", () => {
  const { series, season } = fixture();
  const marker = { fileEpisodeNumber: 1, firstEpisodeNumber: 1, lastEpisodeNumber: 2 };
  season.episodes[0].combinedFile = marker;
  season.episodes[1].combinedFile = marker;
  season.episodes[1].file = season.episodes[0].file;
  season.episodes[1].status = "available";
  assert.deepEqual(combinedEpisodePeers(series, 1, 2), [1, 2]);
  season.episodes[1].file = { ...season.episodes[1].file!, path: path.resolve("fixture", "other.mkv") };
  assert.deepEqual(combinedEpisodePeers(series, 1, 2), [2]);
});
