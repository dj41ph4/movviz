import assert from "node:assert/strict";
import { test } from "node:test";
import { canComplete, completionBoundaryMs, isPlausiblePlaybackAdvance, MIN_REAL_PLAYBACK_MS } from "../src/lib/playback/progressPolicy.ts";

test("fallback uses five minutes for a feature film", () => {
  const result = completionBoundaryMs(7_200_000, [], "movie");
  assert.equal(result.boundaryMs, 6_900_000);
  assert.equal(result.source, "fallback");
});

test("final credits marker wins over fallback", () => {
  const result = completionBoundaryMs(7_200_000, [
    { type: "credits", startMs: 6_800_000, endMs: 7_000_000, final: false },
    { type: "credits", startMs: 6_950_000, endMs: 7_150_000, final: true },
  ], "movie");
  assert.equal(result.boundaryMs, 6_950_000);
  assert.equal(result.source, "plex_final_credits");
});

test("a seek-sized jump is not plausible playback", () => {
  assert.equal(isPlausiblePlaybackAdvance(10_000, 3_600_000, 10_000, 1), false);
  assert.equal(isPlausiblePlaybackAdvance(10_000, 20_000, 10_000, 1), true);
});

test("completion requires one minute of actual playback", () => {
  assert.equal(canComplete(MIN_REAL_PLAYBACK_MS - 1, 6_900_000, 6_900_000), false);
  assert.equal(canComplete(MIN_REAL_PLAYBACK_MS, 6_900_000, 6_900_000), true);
});
