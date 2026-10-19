import test from "node:test";
import assert from "node:assert/strict";

// An integral must file every episode into its Movviz season, whatever the
// numbering of the files: absolute (S01E150, "150"), season folders, and the
// standalone TYBW run (S17 1-50 → cours 1-4).
async function setup() {
  const { planBleachEngineTargets } = await import("@/lib/library/bleachEngine");
  const { BLEACH_ORIGINAL_COUNTS, BLEACH_TYBW_COURS } = await import("@/lib/metadata/bleachEpisodeOrder");
  const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
  const { resolveEpisodePlacement } = await import("../engine/src/episodePlacement.mjs");
  const { parseRelease } = await import("@/lib/naming/parser");
  const backend: any = Object.create(AbstractBackend.prototype);
  const place = (targets: any[], path: string) => {
    const name = path.split("/").pop()!;
    const matches = targets.filter(t => backend._matchesEpisode({ name, path }, t, targets));
    let placement = null; try { placement = matches.length ? resolveEpisodePlacement(matches, parseRelease(name), name) : null; } catch (e: any) { throw new Error(`${path}: ${e.message} (${matches.length} matches)`); }
    return placement ? `S${placement.placement.season}E${placement.placement.episode}` : null;
  };
  const original = BLEACH_ORIGINAL_COUNTS.flatMap((count: number, s: number) => Array.from({ length: count }, (_, e) => ({ season: s + 1, episode: e + 1 })));
  const tybw = BLEACH_TYBW_COURS.flatMap(c => Array.from({ length: c.count }, (_, i) => ({ season: 17, episode: c.offset + i + 1 })));
  return { planBleachEngineTargets, original, tybw, place };
}

test("original integral files absolute numbers into their season, with any title form", async () => {
  const { planBleachEngineTargets, original, place } = await setup();
  for (const title of ["Bleach.Integrale.MULTI.1080p", "Bleach.COMPLETE.S01-S16.1080p", "Bleach.S01E001-E366.1080p", "Bleach 366 episodes 1080p"]) {
    const targets = planBleachEngineTargets(original, title, "tvdbAiring", true);
    assert.equal(targets.length, 366, title);
    for (const [n, expected] of [[5, "S1E5"], [50, "S3E9"], [150, "S7E19"], [300, "S14E35"], [366, "S16E24"]] as const) {
      assert.equal(place(targets, `Bleach/Bleach - ${String(n).padStart(3, "0")} [1080p].mkv`), expected, `${title} #${n}`);
      assert.equal(place(targets, `Bleach/Bleach - ${String(n).padStart(3, "0")}.mkv`), expected, `${title} #${n}`);
    }
    assert.equal(place(targets, "Bleach S01E150.mkv"), "S7E19", title);
  }
});

test("per-season folders keep local numbering; a season-qualified pack is not read as absolute", async () => {
  const { planBleachEngineTargets, original, place } = await setup();
  const integral = planBleachEngineTargets(original, "Bleach.Integrale.MULTI.1080p", "tvdbAiring", true);
  assert.equal(place(integral, "Bleach/Saison 02/Bleach - 005.mkv"), "S2E5");
  assert.equal(place(integral, "Bleach/Saison 03/Bleach - 050.mkv"), "S3E9"); // absolute inside a season folder
  const season3 = planBleachEngineTargets(original.filter(t => t.season === 3), "Bleach.S03.COMPLETE.1080p", "tvdbAiring", true);
  assert.equal(place(season3, "Bleach - 05.mkv"), "S3E5");
});

test("TYBW integral splits the S17 absolute numbering into cours 1-4", async () => {
  const { planBleachEngineTargets, tybw, place } = await setup();
  const targets = planBleachEngineTargets(tybw, "Bleach.Thousand-Year.Blood.War.COMPLETE.1080p", "tmdbAiring", true);
  assert.equal(targets.length, 50);
  for (const [n, expected] of [[1, "S1E1"], [13, "S1E13"], [14, "S2E1"], [26, "S2E13"], [27, "S3E1"], [40, "S3E14"], [41, "S4E1"], [50, "S4E10"]] as const) {
    assert.equal(place(targets, `Bleach TYBW - ${String(n).padStart(2, "0")}.mkv`), expected, `#${n}`);
    assert.equal(place(targets, `Bleach.S17E${String(n).padStart(2, "0")}.mkv`), expected, `S17E${n}`);
  }
});

test("activity rows show TYBW as its own series but keep canonical coordinates for native clients", async () => {
  const { presentBleachActivityMedia } = await import("@/lib/metadata/bleachPresentation");
  type Row = { type: string; tmdbId: number; title: string; href: string; season?: number; episode?: number; packEpisodeCount?: number; displayTitle?: string; displaySeason?: number | null; displayEpisode?: number | null };
  const base: Row = { type: "series", tmdbId: 30984, title: "Bleach", href: "/title/series/30984" };
  const single = presentBleachActivityMedia<Row>({ ...base, season: 17, episode: 44 });
  assert.deepEqual([single.season, single.episode, single.displaySeason, single.displayEpisode], [17, 44, 4, 4]);
  assert.equal(single.displayTitle, "Bleach: Thousand-Year Blood War");
  assert.equal(single.title, "Bleach");
  assert.equal(single.href, "/title/series/30984?part=tybw");
  const pack = presentBleachActivityMedia<Row>({ ...base, season: 17, episode: 1, packEpisodeCount: 50 });
  assert.equal(pack.displaySeason, null);
  assert.equal(presentBleachActivityMedia({ ...base, season: 3, episode: 2 }).href, "/title/series/30984?part=original");
  const other: Row = { ...base, tmdbId: 1, season: 17, episode: 1 };
  assert.equal(presentBleachActivityMedia(other), other);
});

test("manual TYBW search keeps releases named with the absolute S17 numbering", async () => {
  const { bleachManualSearchTargets, bleachReleaseTargets } = await import("@/lib/library/bleachRelease");
  const targets = bleachManualSearchTargets({ kind: "episode", seriesId: "x", season: 17, episode: 41 } as any, "tybw");
  assert.equal(bleachReleaseTargets(targets, "Bleach.S17E41.MULTI.VFF.1080p.WEB.AAC.2.0.H264-TsundereRaws").length, 1);
  assert.equal(bleachReleaseTargets(targets, "Bleach.S17E40.MULTI.VFF.1080p.WEB").length, 0);
});
