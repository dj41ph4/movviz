import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";
import { fankaiPartNumber, targetsLookLikeFanVersion } from "../engine/src/fankaiNames.mjs";

// Real layout of the Fan-Kai pack « Bleach Yabaï » (GitLab ElPouki/fankai_pack):
// parts filed by saga in « Saison N » folders, numbered straight through.
const PACK = "Bleach Yabai";
const LAYOUT = [
  [1, "[Johker] Bleach Yabaï - 01 - Death and Strawberry - 1080p.MULTI.x264.mkv"],
  [1, "[Johker] Bleach Yabaï - 04 - The Blade And Me - 1080p.MULTI.x264.mkv"],
  [2, "[Johker] Bleach Yabaï - 05 - Fourteen days for conspiracy - 1080p.MULTI.x264.mkv"],
  [2, "[Johker] Bleach Yabaï - 10 -  No Goodbye - 1080p.MULTI.x264.mkv"],
  [3, "[Johker] Bleach Yabaï - 25 - Deicide - 1080p.MULTI.x264.mkv"],
  [4, "[Johker] Bleach Yabaï - 28 - The Lost Agent - 1080p.MULTI.x264.mkv"],
];
const files = LAYOUT.map(([saga, name]) => ({ name, path: `${PACK}/Saison ${saga}/${name}`, length: 1_500_000_000 }));
const backend = Object.create(AbstractBackend.prototype);
const fanTargets = Array.from({ length: 28 }, (_, i) => ({ season: 1, episode: i + 1, fanVersion: true }));
const matched = (targets) => files.map((f) => targets.filter((t) => backend._matchesEpisode(f, t, targets, null)).map((t) => `${t.season}x${t.episode}`).join(",") || "—");

test("Fan-Kai part numbers are read from the file name", () => {
  assert.equal(fankaiPartNumber("[Johker] Bleach Yabaï - 05 - Fourteen days for conspiracy - 1080p.MULTI.x264.mkv"), 5);
  assert.equal(fankaiPartNumber("[Odji-san] Death Note Kaï - 03 - Second Kira 1080p Multi x264.mkv"), 3);
  assert.equal(fankaiPartNumber("One Piece Yabai - 008 - La Route de tous les Périls - 1080p.MULTI.x264 [Mixouille].mkv"), 8);
  assert.equal(fankaiPartNumber("Jujutsu Kaisen - 05 - Fearsome Womb 1080p.mkv"), null);
  assert.equal(fankaiPartNumber("Bleach.S02E05.1080p.WEB.x264.mkv"), null);
});

test("every part of a saga-foldered pack reaches its film on a fan version's fiche", () => {
  assert.deepEqual(matched(fanTargets), ["1x1", "1x4", "1x5", "1x10", "1x25", "1x28"]);
});

test("unmarked targets read the same files exactly as before (folder season decides)", () => {
  const plain = fanTargets.map(({ season, episode }) => ({ season, episode }));
  assert.equal(targetsLookLikeFanVersion(plain), false);
  // Without the marker the folder season wins: only « Saison 1 » files match season-1 targets.
  assert.deepEqual(matched(plain), ["1x1", "1x4", "—", "—", "—", "—"]);
});

test("a real « … Kai » series keeps its per-season reading", () => {
  // Dragon Ball Z Kai (TMDb) pack numbered per season: never marked fanVersion.
  const dbz = [
    { name: "Dragon Ball Z Kai - 05 - Title - 1080p.mkv", path: "DBZ Kai/Saison 2/Dragon Ball Z Kai - 05 - Title - 1080p.mkv", length: 1 },
  ];
  const targets = [{ season: 1, episode: 5 }, { season: 2, episode: 5 }];
  assert.deepEqual(targets.filter((t) => backend._matchesEpisode(dbz[0], t, targets, null)).map((t) => `${t.season}x${t.episode}`), ["2x5"]);
});

test("the engine's Fan-Kai marker matches the web side's", async () => {
  const { readFileSync } = await import("node:fs");
  const web = readFileSync(new URL("../src/lib/metadata/fankaiWikitext.ts", import.meta.url), "utf8").match(/const FAN_MARKER = (.+);/)[1];
  const engine = readFileSync(new URL("../engine/src/fankaiNames.mjs", import.meta.url), "utf8").match(/const FAN_MARKER = (.+);/)[1];
  assert.equal(engine, web);
});
