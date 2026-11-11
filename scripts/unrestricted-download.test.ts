import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { runUnrestricted, isUnrestricted } from "@/lib/library/unrestricted";
import { loadReleaseRules } from "@/lib/library/releaseRules";

const rules = { ...loadReleaseRules(), blockedWords: ["VOSTFR"] };
const title = "Some.Show.S01E01.VOSTFR.1080p.WEB.x264";

test("hors mode sans restriction, un mot interdit bloque toujours l'auto-grab", () => {
  assert.equal(isUnrestricted(), false);
  assert.equal(isBlockedForAutoGrab(title, rules).blocked, true);
});

test("le mode sans restriction ignore les mots interdits, y compris après un await", async () => {
  await runUnrestricted(async () => {
    assert.equal(isBlockedForAutoGrab(title, rules).blocked, false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(isUnrestricted(), true);
    assert.equal(isBlockedForAutoGrab(title, rules).blocked, false);
  });
});

test("le mode ne fuit pas vers une recherche automatique parallèle", async () => {
  let parallel: boolean | null = null;
  const manual = runUnrestricted(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  await new Promise((resolve) => setTimeout(resolve, 5));
  parallel = isBlockedForAutoGrab(title, rules).blocked;
  await manual;
  assert.equal(parallel, true);
  assert.equal(isUnrestricted(), false);
});
