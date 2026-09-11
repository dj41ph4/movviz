import assert from "node:assert/strict";
import test from "node:test";
import { audienceSignal } from "@/lib/recommender/audienceSignal";
import { matchKeywordAffinity } from "@/lib/userContext/taste";

test("audience traction ranks a broadly watched title above an obscure one", () => {
  const popular = audienceSignal({ popularity: 150, voteCount: 8_000 });
  const obscure = audienceSignal({ popularity: 2, voteCount: 12 });
  assert.ok(popular > obscure + 0.5);
});

test("popularity lets a same-day breakout rise before votes accumulate", () => {
  const breakout = audienceSignal({ popularity: 180, voteCount: 40 });
  const dormant = audienceSignal({ popularity: 4, voteCount: 400 });
  assert.ok(breakout > dormant);
});

test("missing audience metadata is neutral and deterministic", () => {
  assert.equal(audienceSignal({}), 0);
});

test("several matching themes reinforce a recommendation beyond a broad genre", () => {
  const preferences = new Map([["time travel", 4], ["found family", 3], ["space mission", 2]]);
  const precise = matchKeywordAffinity(["time travel", "found family", "space mission"], preferences);
  const generic = matchKeywordAffinity(["drama"], preferences);
  assert.ok(precise > 0.7);
  assert.equal(generic, 0);
});
