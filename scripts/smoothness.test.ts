import assert from "node:assert/strict";
import test from "node:test";
import { assessFrames, nextStreak } from "@/lib/motion/smoothness";

const frames = (count: number, ms: number) => Array<number>(count).fill(ms);

test("a steady 30 fps is healthy: measured on a capped browser, must never trigger", () => {
  assert.equal(assessFrames(frames(240, 33.4)), "smooth");
  assert.equal(assessFrames(frames(480, 16.7)), "smooth");
});

test("a low frame rate or frequent long frames count as struggling", () => {
  assert.equal(assessFrames(frames(100, 80)), "struggling");
  assert.equal(assessFrames([...frames(300, 16.7), ...frames(100, 60)]), "struggling");
});

test("a few long frames in a fluid window are not a verdict", () => {
  assert.equal(assessFrames([...frames(470, 16.7), ...frames(5, 120)]), "smooth");
});

test("a suspended or empty window says nothing", () => {
  assert.equal(assessFrames([...frames(100, 16.7), 6000]), "invalid");
  assert.equal(assessFrames(frames(3, 16.7)), "invalid");
});

test("repeated freezes of a second or two are a difficulty, not a suspended page", () => {
  assert.equal(assessFrames([...frames(40, 16.7), 1800, 1800, 1800, 1800]), "struggling");
});

test("the streak needs consecutive struggling windows, and invalid ones do not break it", () => {
  assert.equal(nextStreak(1, "struggling"), 2);
  assert.equal(nextStreak(2, "smooth"), 0);
  assert.equal(nextStreak(2, "invalid"), 2);
});
