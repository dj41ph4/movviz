import test from "node:test";
import assert from "node:assert/strict";
import { BLEACH_ORIGINAL_COUNTS, BLEACH_TYBW_COURS, isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachCompletePackCovers, bleachIndexerQueries, bleachManualSearchTargets, bleachMatchingTitle, bleachReleaseTargets } from "@/lib/library/bleachRelease";
import { bleachEpisodeInScope, scopedBleachSeries } from "@/lib/library/bleachScope";
import type { LibrarySeries } from "@/lib/library/types";

const targets = Array.from({ length: 53 }, (_, i) => ({ season: 17, episode: i + 1 }));
const originalTargets = BLEACH_ORIGINAL_COUNTS.flatMap((count, index) => Array.from({ length: count }, (_, i) => ({ season: index + 1, episode: i + 1 })));
test("every TYBW cour selects only its own canonical episodes and local source filenames", () => {
  for (const cour of BLEACH_TYBW_COURS) {
    const raw = `Bleach.Thousand.Year.Blood.War.S0${cour.part}.COMPLETE.1080p`;
    const selected = bleachReleaseTargets(targets, raw);
    assert.equal(selected.length, cour.count);
    assert.deepEqual(selected.map(t => t.episode), Array.from({ length: cour.count }, (_, i) => i + 1));
    assert.deepEqual(selected.map(t => t.library.episode), Array.from({ length: cour.count }, (_, i) => cour.offset + i + 1));
    assert.ok(selected.every(t => t.season === cour.part));
    assert.deepEqual(bleachIndexerQueries(17, cour.offset + 1)[0], { title: "Bleach", season: 17, episode: cour.offset + 1, tvdbId: null });
    assert.deepEqual(bleachIndexerQueries(17, cour.offset + 1)[1], { title: "Bleach Thousand-Year Blood War", season: cour.part, episode: 1, tvdbId: null });
    assert.deepEqual(bleachReleaseTargets([{ season: 2, episode: 1 }], raw), []);
  }
});
test("TYBW cour 3 pack covers canonical Bleach season 17 episodes 27 through 40", () => {
  const raw = "Bleach.Thousand-Year.Blood.War.The.Conflict.S03.COMPLETE.1080p";
  const courThreeTargets = targets.filter(t => t.episode >= 27 && t.episode <= 40);
  const selected = bleachReleaseTargets(courThreeTargets, raw);

  assert.deepEqual(selected[0], { season: 3, episode: 1, library: { season: 17, episode: 27 } });
  assert.deepEqual(selected.at(-1), { season: 3, episode: 14, library: { season: 17, episode: 40 } });
  assert.deepEqual(bleachIndexerQueries(17, 27, 3)[0], { title: "Bleach", season: 17, episode: 27, tvdbId: null });
  assert.deepEqual(bleachIndexerQueries(17, 27, 3)[1], { title: "Bleach Thousand-Year Blood War", season: 3, episode: 1, tvdbId: null });
  assert.deepEqual(bleachIndexerQueries(17, null, 3)[0], { title: "Bleach", season: 17, episode: null, tvdbId: null });
});
test("a full TYBW search keeps cour seasons 1-4 and adds the indexer S17 convention", () => {
  assert.deepEqual(bleachIndexerQueries(17, null).map(query => query.season), [17, 1, 2, 3, 4]);
});
test("canonical S17 releases without a TYBW subtitle still cover TYBW, never original S03", () => {
  assert.deepEqual(bleachReleaseTargets([{ season: 17, episode: 27 }], "Bleach.S17E27.1080p"), [
    { season: 17, episode: 27, library: { season: 17, episode: 27 } },
  ]);
  assert.deepEqual(bleachReleaseTargets([{ season: 3, episode: 1 }], "Bleach.S17E27.1080p"), []);
});
test("manual search for TYBW S17E41 returns only cour 4 sources, including indexer S17 numbering", () => {
  const ref = { kind: "episode", seriesId: "bleach", season: 17, episode: 41 } as const;
  const targets = bleachManualSearchTargets(ref, "tybw", 4);
  assert.deepEqual(targets, [{ season: 17, episode: 41 }]);
  assert.equal(bleachReleaseTargets(targets, "Bleach.Thousand-Year.Blood.War.S04.COMPLETE.1080p").length, 1);
  assert.equal(bleachReleaseTargets(targets, "Bleach.Thousand-Year.Blood.War.S03.COMPLETE.1080p").length, 0);
  assert.equal(bleachReleaseTargets(targets, "Bleach.S17E41.1080p").length, 1);
  assert.equal(bleachManualSearchTargets({ kind: "season", seriesId: "bleach", season: 17 }, "tybw", 4).length, 10);
});
test("a 366-episode S01 original pack maps absolute source numbering across all 16 Movviz seasons", () => {
  const release = "Bleach.S01E001-E366.COMPLETE.1080p";
  const mapped = bleachReleaseTargets(originalTargets, release);
  assert.equal(bleachCompletePackCovers(release, originalTargets), true);
  assert.equal(mapped.length, 366);
  assert.deepEqual(mapped[0], { season: 1, episode: 1, library: { season: 1, episode: 1 } });
  assert.deepEqual(mapped[19], { season: 1, episode: 20, library: { season: 1, episode: 20 } });
  assert.deepEqual(mapped[20], { season: 1, episode: 21, library: { season: 2, episode: 1 } });
  assert.deepEqual(mapped[365], { season: 1, episode: 366, library: { season: 16, episode: 24 } });
  assert.equal(bleachCompletePackCovers("Bleach.S01.COMPLETE.366.Episodes.1080p", originalTargets), true);
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
