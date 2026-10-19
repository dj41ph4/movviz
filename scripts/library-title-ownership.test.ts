import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTitle, registerLibraryTitleIndex, releaseTitleMatches } from "@/lib/library/matching";

// Confirmed live: an automatic search for « Dragon Ball Super : Beerus » (TMDb 312359) grabbed
// « Dragon.Ball.Super.INTEGRALE » — the complete run of « Dragon Ball Super » (TMDb 62715), another
// series of the same library — because a release name that drops the subtitle is fully contained
// in the longer title.
test("a release named exactly like another library title belongs to that title", () => {
  registerLibraryTitleIndex(() => new Set(["Dragon Ball Super", "Dragon Ball Super : Beerus", "Tafiti - Ab durch die Wüste"].map(normalizeTitle)));
  assert.equal(releaseTitleMatches("Dragon Ball Super", "Dragon Ball Super : Beerus"), false);
  assert.equal(releaseTitleMatches("Dragon Ball Super", "Dragon Ball Super"), true);
  assert.equal(releaseTitleMatches("Dragon Ball Super Beerus", "Dragon Ball Super : Beerus"), true);
  // Subtitle dropped by the release, no other library title of that name: still accepted.
  assert.equal(releaseTitleMatches("Tafiti", "Tafiti - Ab durch die Wüste"), true);
  // An alias a person set on the target keeps working even if it names another entry.
  assert.equal(releaseTitleMatches("Dragon Ball Super", "Dragon Ball Super : Beerus", ["Dragon Ball Super"]), true);
});
