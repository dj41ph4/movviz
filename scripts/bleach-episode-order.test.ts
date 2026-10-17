import test from "node:test";
import assert from "node:assert/strict";
import { BLEACH_ORIGINAL_COUNTS, bleachFromTmdb, bleachToTmdb, bleachSeasonSummaries, detectBleachLibraryOrder, normalizeBleachPlexEpisodes } from "../src/lib/metadata/bleachEpisodeOrder.ts";
import { planBleachRepair } from "../src/lib/library/bleachRepair.ts";
import { bleachMatchingTitle, bleachReleaseSource } from "../src/lib/library/bleachRelease.ts";
import { parseRelease } from "../src/lib/naming/parser.ts";
import type { LibrarySeries, LibraryEpisode } from "../src/lib/library/types.ts";

function episode(seasonNumber: number, episodeNumber: number): LibraryEpisode {
  return { seasonNumber, episodeNumber, title: `Episode ${episodeNumber}`, airDate: "2005-01-01", monitored: true, status: "missing", file: null, activeInfoHash: null, plexRatingKey: null };
}
function library(): LibrarySeries {
  return {
    id: "sr_bleach", tmdbId: 30984, tvdbId: 74796, title: "Bleach", year: 2004,
    seasons: [
      { seasonNumber: 1, name: "Bleach", monitored: true, episodes: Array.from({ length: 366 }, (_, i) => episode(1, i + 1)) },
      { seasonNumber: 2, name: "TYBW", monitored: true, episodes: Array.from({ length: 53 }, (_, i) => episode(2, i + 1)) },
    ],
    monitored: true, plexRatingKey: "show-key", qualityProfileId: "default", addedAt: 123,
  } as LibrarySeries;
}

test("all 366 original Bleach episodes map bijectively across 16 seasons", () => {
  assert.equal(BLEACH_ORIGINAL_COUNTS.reduce<number>((sum, n) => sum + n, 0), 366);
  const identities = new Set<string>();
  for (let episode = 1; episode <= 366; episode++) {
    const mapped = bleachFromTmdb(1, episode)!;
    identities.add(`${mapped.seasonNumber}:${mapped.episodeNumber}`);
    assert.deepEqual(bleachToTmdb(mapped.seasonNumber, mapped.episodeNumber), { seasonNumber: 1, episodeNumber: episode });
  }
  assert.equal(identities.size, 366);
  assert.deepEqual(bleachFromTmdb(1, 21), { seasonNumber: 2, episodeNumber: 1 });
  assert.deepEqual(bleachFromTmdb(1, 366), { seasonNumber: 16, episodeNumber: 24 });
});

test("historical S02E01 and TYBW episode 1 remain different identities", () => {
  assert.deepEqual(bleachToTmdb(2, 1), { seasonNumber: 1, episodeNumber: 21 });
  assert.deepEqual(bleachToTmdb(17, 1), { seasonNumber: 2, episodeNumber: 1 });
  for (let episode = 1; episode <= 53; episode++) assert.deepEqual(bleachFromTmdb(2, episode), { seasonNumber: 17, episodeNumber: episode });
  assert.equal(bleachFromTmdb(1, 367), null);
  assert.equal(bleachToTmdb(2, 22), null);
});

test("season summaries retain specials and dynamic TYBW counts without fake IDs", () => {
  const result = bleachSeasonSummaries([{ seasonNumber: 0, name: "Specials", episodeCount: 4 }, { seasonNumber: 1, name: "Bleach", episodeCount: 366 }, { seasonNumber: 2, name: "TYBW", episodeCount: 53 }]);
  assert.equal(result.length, 18);
  assert.equal(result.find((s) => s.seasonNumber === 2)?.episodeCount, 21);
  assert.equal(result.find((s) => s.seasonNumber === 17)?.episodeCount, 53);
});

test("partial legacy S02E01 does not prove the order", () => {
  assert.equal(detectBleachLibraryOrder({ tmdbId: 30984, seasons: [{ seasonNumber: 2, episodes: [{ episodeNumber: 1 }] }] }), "ambiguous");
  assert.equal(detectBleachLibraryOrder(library()), "tmdb");
  assert.equal(detectBleachLibraryOrder({ ...library(), episodeOrder: "tvdb" }), "tvdb");
});

test("repair preserves exact files, Plex links, extra fields and series identity", () => {
  const series = library();
  const file = { path: "/media/Bleach/S02E01.mkv", addedAt: 123, size: 456 } as NonNullable<LibraryEpisode["file"]>;
  series.seasons[0].episodes[20] = { ...series.seasons[0].episodes[20], file, status: "available", plexRatingKey: "episode-21", playbackSource: "plex", lastPlexSyncAt: 654 };
  const before = JSON.stringify(series);
  const plan = planBleachRepair(series, Array.from({ length: 20 }, (_, i) => ({ store: "watch", seasonNumber: 1, episodeNumber: i + 1 })));
  assert.equal(plan.applicable, true);
  assert.equal(plan.episodes, 419);
  assert.equal(plan.movedEpisodes, 399);
  assert.equal(plan.preservedTracking, 20);
  assert.equal(plan.next.id, series.id);
  assert.equal(plan.next.plexRatingKey, series.plexRatingKey);
  const target = plan.next.seasons.find((s) => s.seasonNumber === 2)!.episodes[0];
  assert.equal(target.file, file);
  assert.equal(target.plexRatingKey, "episode-21");
  assert.equal(target.lastPlexSyncAt, 654);
  assert.equal(JSON.stringify(series), before);
});

test("ambiguous tracking and active downloads block repair, including unwatched tombstones", () => {
  assert.ok(planBleachRepair(library(), [{ store: "watchlist-tombstone", seasonNumber: 2, episodeNumber: 1 }]).blockers.includes("ambiguous_user_history"));
  const series = library();
  series.seasons[0].episodes[1].activeInfoHash = "active";
  assert.ok(planBleachRepair(series, []).blockers.includes("active_download"));
  assert.notEqual(planBleachRepair(library(), [], "before").fingerprint, planBleachRepair(library(), [], "after").fingerprint);
});

test("Plex TVDB and TMDb snapshots normalize to the same episode identities", () => {
  const tmdb = [{ seasonNumber: 1, episodeNumber: 21, ratingKey: "historical" }, { seasonNumber: 2, episodeNumber: 1, ratingKey: "tybw" }];
  assert.deepEqual(normalizeBleachPlexEpisodes("Bleach", tmdb, "tmdbAiring"), [{ ...tmdb[0], seasonNumber: 2, episodeNumber: 1 }, { ...tmdb[1], seasonNumber: 17 }]);
  assert.equal(normalizeBleachPlexEpisodes("Bleach", [{ seasonNumber: 2, episodeNumber: 1 }]), null);
  assert.deepEqual(normalizeBleachPlexEpisodes("Bleach", [{ seasonNumber: 2, episodeNumber: 1 }], "tvdbAiring"), [{ seasonNumber: 2, episodeNumber: 1 }]);
});

test("standalone TYBW cour release maps to S17 while original Bleach remains separate", () => {
  const raw = "Bleach.Thousand-Year.Blood.War.The.Separation.S02E01.1080p.WEB-DL.x265";
  const matching = parseRelease(bleachMatchingTitle(raw, 17, false));
  assert.equal(matching.season, 17);
  assert.equal(matching.episode, 14);
  assert.equal(matching.resolution, "1080p");
  assert.deepEqual(bleachReleaseSource(raw, 17, 14), { seasonNumber: 2, episodeNumber: 1 });
  assert.equal(bleachReleaseSource(raw, 2, 1), null);
  assert.equal(bleachMatchingTitle(raw, 2, false), "__different_bleach_series__");
  assert.equal(bleachMatchingTitle(raw, 17, true), "__not_a_bleach_pack__");
  assert.equal(parseRelease(bleachMatchingTitle(raw.replace("S02E01", "S02"), 17, true)).season, 17);
});

test("TYBW Conflict first episode keeps its canonical cumulative identity", () => {
  const raw = "Bleach.Sennen.Kessen-hen.Soukoku-tan.S01E01.1080p";
  const matching = parseRelease(bleachMatchingTitle(raw, 17, false));
  assert.equal(matching.episode, 27);
  assert.deepEqual(normalizeBleachPlexEpisodes("Bleach Thousand-Year Blood War The Conflict", [{ seasonNumber: 1, episodeNumber: 1, ratingKey: "a" }]), [{ seasonNumber: 17, episodeNumber: 27, ratingKey: "a" }]);
});
