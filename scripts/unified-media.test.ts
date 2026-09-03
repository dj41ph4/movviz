import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaStateKey, reconcileField } from "@/lib/userContext/reconcile";
import { watchlistKey } from "@/lib/watchlist/store";

test("field reconciliation is timestamp LWW, including descending progress", () => {
  const first = reconcileField({ value: 0, updatedAt: null, source: null }, { value: 0.8, occurredAt: 100, source: "movviz", eventId: "a" });
  const second = reconcileField(first.state, { value: 0.2, occurredAt: 200, source: "plex", eventId: "b" });
  assert.equal(second.applied, true);
  assert.equal(second.state.value, 0.2);
  const stale = reconcileField(second.state, { value: 0.9, occurredAt: 150, source: "movviz", eventId: "c" });
  assert.equal(stale.applied, false);
  assert.equal(stale.reason, "stale");
});

test("equal timestamp uses deterministic event id tie-break", () => {
  const a = reconcileField({ value: false, updatedAt: 100, source: "x", eventId: "a" }, { value: true, occurredAt: 100, source: "plex", eventId: "b" });
  assert.equal(a.applied, true);
  const b = reconcileField(a.state, { value: false, occurredAt: 100, source: "movviz", eventId: "a" });
  assert.equal(b.applied, false);
});

test("media and watchlist identities include episode coordinates", () => {
  assert.equal(mediaStateKey("u1", "episode", 10, 2, 5), "u1:episode:10:2:5");
  assert.equal(watchlistKey({ type: "episode", tmdbId: 10, seasonNumber: 2, episodeNumber: 5 }), "episode:10:2:5");
  assert.notEqual(watchlistKey({ type: "episode", tmdbId: 10, seasonNumber: 2, episodeNumber: 5 }), watchlistKey({ type: "episode", tmdbId: 10, seasonNumber: 2, episodeNumber: 6 }));
});
