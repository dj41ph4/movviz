import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeSeriesRelease } from "@/lib/library/matching";

test("une release d'épisode ou de saison n'est jamais un film", () => {
  for (const title of [
    "Van.Helsing.S05E03.MULTi.1080p.WEB.x264-GRP",
    "Resident.Evil.2026.S01.MULTi.1080p.WEB-DL",
    "Van Helsing - Saison 2 - 1080p",
    "Resident Evil Season 1 2160p",
    "Van.Helsing.S01E01E02.1080p",
  ]) {
    assert.equal(looksLikeSeriesRelease(title), true, title);
  }
});

test("les vraies releases de films restent acceptées", () => {
  for (const title of [
    "Resident.Evil.2026.MULTi.1080p.BluRay.x264-GRP",
    "Van.Helsing.2004.Special.Edition.1080p.BluRay",
    "Season.of.the.Witch.2011.1080p.BluRay",
    "Se7en.1995.REMASTERED.2160p.UHD",
    "S.W.A.T.2003.1080p.BluRay",
  ]) {
    assert.equal(looksLikeSeriesRelease(title), false, title);
  }
});

test("le worker de matching applique le même motif que matching.ts", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const src = readFileSync(resolve("src/lib/library/matching.ts"), "utf8").match(/const SERIES_MARKER_RE = (.+);/)?.[1];
  const worker = readFileSync(resolve("src/lib/workers/releaseMatchWorker.mjs"), "utf8").match(/const SERIES_MARKER_RE = (.+);/)?.[1];
  assert.ok(src);
  assert.equal(worker, src);
});
