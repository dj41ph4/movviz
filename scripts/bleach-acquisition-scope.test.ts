import test from "node:test";
import assert from "node:assert/strict";
import { BLEACH_TYBW_COURS, isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachIndexerQueries, bleachMatchingTitle, bleachReleaseTargets } from "@/lib/library/bleachRelease";
import { bleachEpisodeInScope, scopedBleachSeries } from "@/lib/library/bleachScope";
import type { LibrarySeries } from "@/lib/library/types";

const targets = Array.from({ length: 53 }, (_, i) => ({ season: 17, episode: i + 1 }));
test("every TYBW cour selects only its own canonical episodes and local source filenames", () => {
  for (const cour of BLEACH_TYBW_COURS) {
    const raw = `Bleach.Thousand.Year.Blood.War.S0${cour.part}.COMPLETE.1080p`;
    const selected = bleachReleaseTargets(targets, raw);
    assert.equal(selected.length, cour.count);
    assert.deepEqual(selected.map(t => t.episode), Array.from({ length: cour.count }, (_, i) => i + 1));
    assert.deepEqual(selected.map(t => t.library.episode), Array.from({ length: cour.count }, (_, i) => cour.offset + i + 1));
    assert.ok(selected.every(t => t.season === cour.part));
    assert.deepEqual(bleachIndexerQueries(17, cour.offset + 1), [{ title: "Bleach Thousand-Year Blood War", season: cour.part, episode: 1, tvdbId: null }]);
    assert.deepEqual(bleachReleaseTargets([{ season: 2, episode: 1 }], raw), []);
  }
});
test("named English and Japanese cours cannot masquerade as original Bleach seasons", () => {
  for (const [title, expected] of [["Bleach.The.Separation.S02E01.1080p", 14], ["BLEACH.相剋譚.S01E01", 27], ["Bleach.The.Calamity.S04E10", 50]] as const) {
    assert.equal(isBleachSequelTitle(title), true);
    assert.equal(bleachMatchingTitle(title, 2, false), "__different_bleach_series__");
    assert.deepEqual(bleachReleaseTargets([{ season: 2, episode: 1 }], title), []);
    assert.equal(bleachReleaseTargets(targets, title)[0]?.library.episode, expected);
  }
  assert.equal(isBleachSequelTitle("The.Conflict.S01E01"), false);
  assert.equal(isBleachSequelTitle("Three.Thousand.Years.of.Longing.2022.1080p"), false);
});
test("unqualified original releases and TYBW have disjoint coverage even with equal S/E labels", () => {
  assert.deepEqual(bleachReleaseTargets(targets, "Bleach.S02E01.1080p"), []);
  assert.deepEqual(bleachReleaseTargets([{ season: 2, episode: 1 }], "Bleach.S02E01.1080p"), [{ season: 2, episode: 1, library: { season: 2, episode: 1 } }]);
  assert.deepEqual(bleachReleaseTargets(targets.slice(0, 13), "Bleach.TYBW.S02.COMPLETE"), []);
  assert.deepEqual(bleachReleaseTargets(targets, "Bleach.TYBW.S01E14"), []);
  assert.deepEqual(bleachReleaseTargets(targets, "Bleach.TYBW.S04E11"), []);
});
test("part/cour acquisition scopes preserve the stored record and exclude unknown legacy extras", () => {
  const series = { id: "preserved", tmdbId: 30984, seasons: [
    { seasonNumber: 2, episodes: [{ seasonNumber: 2, episodeNumber: 1 }] },
    { seasonNumber: 17, episodes: targets.map(t => ({ seasonNumber: 17, episodeNumber: t.episode })) },
  ] } as LibrarySeries;
  const before = JSON.stringify(series);
  assert.deepEqual(scopedBleachSeries(series, "original").seasons.map(s => s.seasonNumber), [2]);
  assert.equal(scopedBleachSeries(series, "tybw").seasons[0].episodes.length, 50);
  const cour = scopedBleachSeries(series, "tybw", 2);
  assert.equal(cour.id, series.id);
  assert.deepEqual(cour.seasons[0].episodes.map(e => e.episodeNumber), Array.from({ length: 13 }, (_, i) => i + 14));
  assert.equal(bleachEpisodeInScope(2, 1, "tybw"), false);
  assert.equal(bleachEpisodeInScope(17, 51, "tybw"), false);
  assert.equal(JSON.stringify(series), before);
});
