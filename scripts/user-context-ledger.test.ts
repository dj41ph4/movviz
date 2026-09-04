import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import { getUserWatchHistory } from "@/lib/userContext/history";

test("context ledger preserves rewatches, dedupes source events and isolates users", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userA = `ctx-ledger-a-${nonce}`;
  const userB = `ctx-ledger-b-${nonce}`;
  const tmdbId = 999_000_001;
  const now = Date.now();

  for (const [sourceEventId, occurredAt] of [
    [`rewatch-1-${nonce}`, now - 30_000],
    [`rewatch-2-${nonce}`, now - 20_000],
    [`rewatch-3-${nonce}`, now - 10_000],
  ] as const) {
    assert.equal(recordUserContextEvent({
      userId: userA,
      eventType: "movie_completed",
      source: "context_test",
      sourceEventId,
      tmdbId,
      mediaType: "movie",
      title: "Context Ledger Test Movie",
      occurredAt,
    }), true);
  }

  // Exact same source event must be idempotent.
  assert.equal(recordUserContextEvent({
    userId: userA,
    eventType: "movie_completed",
    source: "context_test",
    sourceEventId: `rewatch-3-${nonce}`,
    tmdbId,
    mediaType: "movie",
    title: "Context Ledger Test Movie",
    occurredAt: now - 10_000,
  }), false);

  // Same media for another Movviz user must never leak into userA's query.
  assert.equal(recordUserContextEvent({
    userId: userB,
    eventType: "movie_completed",
    source: "context_test",
    sourceEventId: `other-user-${nonce}`,
    tmdbId,
    mediaType: "movie",
    title: "Context Ledger Test Movie",
    occurredAt: now - 5_000,
  }), true);

  const historyA = getUserWatchHistory({ userId: userA, mediaType: "movie", limit: 20 })
    .filter((item) => item.tmdbId === tmdbId);
  const historyB = getUserWatchHistory({ userId: userB, mediaType: "movie", limit: 20 })
    .filter((item) => item.tmdbId === tmdbId);

  assert.equal(historyA.length, 3, "three distinct rewatches must survive");
  assert.equal(historyB.length, 1, "other user must have an isolated history");
  assert.deepEqual(historyA.map((item) => item.watchedAt), [now - 10_000, now - 20_000, now - 30_000]);
});

test("Movviz and Plex views share one per-user timeline ordered by their real timestamps", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `ctx-timeline-${nonce}`;
  const now = Date.now();
  const events = [
    { tmdbId: 999_100_001, title: "Movviz avant", source: "movviz_playback", at: now - 2 * 86_400_000 },
    { tmdbId: 999_100_002, title: "Plex hier", source: "plex_history", at: now - 86_400_000 },
    { tmdbId: 999_100_003, title: "Movviz aujourd’hui", source: "movviz_playback", at: now },
  ];
  for (const event of events) {
    assert.equal(recordUserContextEvent({ userId, eventType: "movie_completed", source: event.source, sourceEventId: `${nonce}:${event.source}:${event.tmdbId}`, tmdbId: event.tmdbId, mediaType: "movie", title: event.title, occurredAt: event.at }), true);
  }
  const timeline = getUserWatchHistory({ userId, mediaType: "movie", limit: 10 })
    .filter((item) => events.some((event) => event.tmdbId === item.tmdbId));
  assert.deepEqual(timeline.map((item) => item.tmdbId), [999_100_003, 999_100_002, 999_100_001]);
});
