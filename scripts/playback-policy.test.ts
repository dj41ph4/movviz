import assert from "node:assert/strict";
import { test } from "node:test";
import { canComplete, completionBoundaryMs, isCredibleEnd, isPlausiblePlaybackAdvance, isSpuriousRestartPosition, MIN_REAL_PLAYBACK_MS } from "../src/lib/playback/progressPolicy.ts";

test("fallback leaves 3 % of the runtime, capped at 90 s, for a feature film", () => {
  const result = completionBoundaryMs(7_200_000, [], "movie");
  assert.equal(result.boundaryMs, 7_110_000);
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

test("completion requires 85 % of the content really played", () => {
  assert.equal(canComplete(MIN_REAL_PLAYBACK_MS, 7_110_000, 7_110_000, 7_200_000, "fallback"), false);
  assert.equal(canComplete(6_120_000 - 1, 7_110_000, 7_110_000, 7_200_000, "fallback"), false);
  assert.equal(canComplete(6_120_000, 7_110_000, 7_110_000, 7_200_000, "fallback"), true);
});

test("episodes follow their end-credits marker, no longer a fixed 80 %", () => {
  const { boundaryMs, source } = completionBoundaryMs(1_440_000, [
    { type: "credits", startMs: 1_380_000, endMs: 1_440_000, final: true },
  ], "episode");
  assert.equal(boundaryMs, 1_380_000);
  assert.equal(canComplete(1_300_000, 1_379_999, boundaryMs, 1_440_000, source), false);
  assert.equal(canComplete(1_300_000, 1_380_000, boundaryMs, 1_440_000, source), true);
  // Without a marker: 3 % of 24 min = 43.2 s before the end.
  assert.equal(completionBoundaryMs(1_440_000, [], "episode").boundaryMs, 1_396_800);
});

test("a near-zero position never replaces a resume point it did not really reach", () => {
  // Closed on the resume prompt / an error before playback started.
  assert.equal(isSpuriousRestartPosition({ positionMs: 0, resumeOffsetMs: 2_400_000, sessionPlayedMs: 0, previousSessionPositionMs: 0 }), true);
  // Stream lost after playing 5 minutes from 40:00: element reports 0.
  assert.equal(isSpuriousRestartPosition({ positionMs: 0, resumeOffsetMs: 2_700_000, sessionPlayedMs: 300_000, previousSessionPositionMs: 2_700_000 }), true);
  // Restarted from the beginning on purpose and watched past 10 s.
  assert.equal(isSpuriousRestartPosition({ positionMs: 95_000, resumeOffsetMs: 2_400_000, sessionPlayedMs: 95_000, previousSessionPositionMs: 85_000 }), false);
  // Watching from the start, nothing further in to protect.
  assert.equal(isSpuriousRestartPosition({ positionMs: 5_000, resumeOffsetMs: 30_000, sessionPlayedMs: 70_000, previousSessionPositionMs: 0 }), false);
  // Genuinely playing from the start after a minute: the resume follows.
  assert.equal(isSpuriousRestartPosition({ positionMs: 9_000, resumeOffsetMs: 2_400_000, sessionPlayedMs: 70_000, previousSessionPositionMs: 0 }), false);
});

test("ended only counts once the session really reached the end zone", () => {
  // Stream cut at 25 min of a 2 h film (boundary 1h55): not an end.
  assert.equal(isCredibleEnd(1_500_000, 6_900_000), false);
  // Last heartbeat 10 s before the real end.
  assert.equal(isCredibleEnd(7_190_000, 6_900_000), true);
  // Just before the boundary, within one missed heartbeat.
  assert.equal(isCredibleEnd(6_850_000, 6_900_000), true);
  // Unknown boundary: keep the previous behaviour.
  assert.equal(isCredibleEnd(0, null), true);
});
