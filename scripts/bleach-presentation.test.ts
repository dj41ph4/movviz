import test from "node:test";
import assert from "node:assert/strict";
import { BLEACH_COURS, bleachDisplayToCanonical, bleachEpisodeLabel, bleachPresentationKey, bleachProjectionPresent, bleachTitleHref, projectBleachLibrary, projectBleachSearchResults } from "@/lib/metadata/bleachPresentation";

test("two Bleach views keep the same provider identity and distinct navigation keys", () => {
  const original = { tmdbId: 30984, type: "series", title: "BLEACH", year: 2004 };
  const views = projectBleachSearchResults([original]);
  assert.equal(views.length, 2);
  assert.deepEqual(views.map(v => v.tmdbId), [30984, 30984]);
  assert.deepEqual(views.map(v => v.year), [2004, 2022]);
  assert.notEqual(bleachPresentationKey(views[0]), bleachPresentationKey(views[1]));
  assert.equal(bleachTitleHref(30984, "series", "tybw"), "/title/series/30984?part=tybw");
  assert.equal(bleachTitleHref(123, "movie", "tybw"), "/title/movie/123");
  assert.equal(original.title, "BLEACH");
});

test("TYBW cour 2 episode 1 remains canonical S17E14 for every action", () => {
  assert.deepEqual(bleachDisplayToCanonical("tybw", 2, 1), { season: 17, episode: 14 });
  assert.deepEqual(bleachDisplayToCanonical("original", 2, 1), { season: 2, episode: 1 });
  assert.equal(bleachEpisodeLabel("tybw", 17, 14), "2x01");
  assert.equal(bleachDisplayToCanonical("tybw", 4, 11), null);
  assert.equal(bleachDisplayToCanonical("tybw", 5, 1), null);
  assert.equal(bleachDisplayToCanonical("original", 17, 1), null);
  assert.equal(BLEACH_COURS.reduce((n, c) => n + c.count, 0), 50);
});

test("library projections scope episodes and preserve stored legacy extras without mutation", () => {
  const series = { id: "stable-history-id", tmdbId: 30984, title: "Bleach", episodeOrder: "tvdb", seasons: [
    { seasonNumber: 2, episodes: [{ seasonNumber: 2, episodeNumber: 1, file: { path: "/original.mkv" }, watched: true }] },
    { seasonNumber: 17, episodes: Array.from({ length: 53 }, (_, i) => ({ seasonNumber: 17, episodeNumber: i + 1, file: { path: `/tybw-${i + 1}.mkv` } })) },
  ] };
  const before = JSON.stringify(series);
  const original = projectBleachLibrary(series, "original"), tybw = projectBleachLibrary(series, "tybw");
  assert.equal(original.id, series.id); assert.equal(tybw.id, series.id);
  assert.deepEqual(original.seasons.map(s => s.seasonNumber), [2]);
  assert.equal(tybw.seasons.length, 1); assert.equal(tybw.seasons[0].seasonNumber, 17);
  assert.equal(tybw.seasons[0].episodes.length, 50);
  assert.equal(tybw.seasons[0].episodes[13].episodeNumber, 14);
  assert.equal(JSON.stringify(series), before); assert.equal(series.seasons[1].episodes.length, 53);
});

test("legacy TMDb metadata projects original 16 seasons and separate TYBW without changing storage", () => {
  const series = { id: "same-id", tmdbId: 30984, title: "Bleach", seasons: [
    { seasonNumber: 1, episodes: Array.from({ length: 366 }, (_, i) => ({ seasonNumber: 1, episodeNumber: i + 1 })) },
    { seasonNumber: 2, episodes: [{ seasonNumber: 2, episodeNumber: 1 }] },
  ] };
  const before = JSON.stringify(series);
  const original = projectBleachLibrary(series, "original"), tybw = projectBleachLibrary(series, "tybw");
  assert.equal(original.seasons.length, 16);
  assert.equal(original.seasons[1].episodes[0].episodeNumber, 1);
  assert.equal(tybw.seasons[0].seasonNumber, 17);
  assert.equal(JSON.stringify(series), before);
});

test("an absent Bleach part stays addable when the other part already owns the canonical record", () => {
  const originalOnly = { id: "preserved-id", tmdbId: 30984, episodeOrder: "tvdb", seasons: [{ seasonNumber: 2, episodes: [{ episodeNumber: 1 }] }] };
  const sequelOnly = { ...originalOnly, seasons: [{ seasonNumber: 17, episodes: [{ episodeNumber: 14 }] }] };
  assert.equal(bleachProjectionPresent(projectBleachLibrary(originalOnly, "original")), true);
  assert.equal(bleachProjectionPresent(projectBleachLibrary(originalOnly, "tybw")), false);
  assert.equal(bleachProjectionPresent(projectBleachLibrary(sequelOnly, "original")), false);
  assert.equal(bleachProjectionPresent(projectBleachLibrary(sequelOnly, "tybw")), true);
  assert.equal(projectBleachLibrary(originalOnly, "tybw").id, originalOnly.id);
});
