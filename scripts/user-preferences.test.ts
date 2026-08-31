import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { getExplicitTitlePreference, upsertExplicitTitlePreference } from "@/lib/userContext/preferences";

test("explicit preference correction overwrites prior stance and stays isolated", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userA = `pref-a-${nonce}`;
  const userB = `pref-b-${nonce}`;
  const tmdbId = 13183;
  assert.equal(upsertExplicitTitlePreference({ userId: userA, tmdbId, mediaType: "movie", title: "Watchmen", affinity: -1, source: "explicit" }), true);
  assert.equal(upsertExplicitTitlePreference({ userId: userA, tmdbId, mediaType: "movie", title: "Watchmen", affinity: 1, source: "correction" }), true);
  assert.equal(upsertExplicitTitlePreference({ userId: userB, tmdbId, mediaType: "movie", title: "Watchmen", affinity: -1, source: "explicit" }), true);
  const a = getExplicitTitlePreference(userA, tmdbId, "movie");
  const b = getExplicitTitlePreference(userB, tmdbId, "movie");
  assert.equal(a?.affinity, 1);
  assert.equal(a?.source, "correction");
  assert.equal(a?.evidenceCount, 2);
  assert.equal(b?.affinity, -1);
});
