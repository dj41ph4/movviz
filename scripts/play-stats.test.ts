import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import { computeStats } from "@/lib/stats/playStats";

const HOUR = 3_600_000;

test("playStats unifie Movviz et Plex, compte une fois le miroir Plex d'une lecture Movviz", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite indisponible ou Context Engine désactivé");
    return;
  }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `play-stats-${nonce}`;
  const now = Date.now();
  const base = { userId, mediaType: "movie" as const, title: "Film de stats" };

  // Lecture Movviz (navigateur, REMUX) de 90 min.
  recordUserContextEvent({
    ...base, eventType: "playback_stopped", source: "movviz_playback", sourceEventId: `m1-${nonce}`,
    tmdbId: 990_001, positionMs: 5_400_000, durationMs: 6_000_000, occurredAt: now - 2 * HOUR,
    payload: { playedMs: 5_400_000, startedAt: now - 3 * HOUR, web: true, browser: "Chrome 130", mode: "REMUX", height: 1080 },
  });
  // Miroir Plex de cette lecture (même titre, 30 min plus tard) : ne doit pas compter.
  recordUserContextEvent({
    ...base, eventType: "watched_marked", source: "plex_history", sourceEventId: `p1-${nonce}`,
    tmdbId: 990_001, occurredAt: now - 90 * 60_000,
  });
  // Vraie vue Plex d'un autre titre : compte.
  recordUserContextEvent({
    ...base, eventType: "watched_marked", source: "plex_history", sourceEventId: `p2-${nonce}`,
    tmdbId: 990_002, title: "Autre film", occurredAt: now - 5 * HOUR,
  });
  // Arrêt de 20 s : pas une lecture. Marquage manuel : pas une lecture non plus.
  recordUserContextEvent({
    ...base, eventType: "playback_stopped", source: "movviz_playback", sourceEventId: `m2-${nonce}`,
    tmdbId: 990_003, positionMs: 20_000, durationMs: 6_000_000, occurredAt: now - HOUR,
    payload: { playedMs: 20_000, startedAt: now - HOUR, web: false, browser: null, mode: null, height: null },
  });
  recordUserContextEvent({
    ...base, eventType: "watched_marked", source: "movviz_manual", sourceEventId: `mm-${nonce}`,
    tmdbId: 990_004, occurredAt: now - HOUR,
  });
  // Date dans le futur (fixture cassée) : ignorée.
  recordUserContextEvent({
    ...base, eventType: "watched_marked", source: "plex_history", sourceEventId: `pf-${nonce}`,
    tmdbId: 990_005, occurredAt: now + 400 * 86_400_000,
  });

  const all = computeStats({ period: 7, userId });
  assert.equal(all.totals.plays, 2, "Movviz + une vue Plex distincte, sans le miroir ni l'arrêt court");
  assert.deepEqual(all.totals.bySource, { movviz: 1, plex: 1 });
  assert.equal(all.totals.users, 1);
  assert.deepEqual(all.byPlatform, [{ key: "web:Chrome", plays: 1 }]);
  assert.deepEqual(all.byMode, [{ key: "REMUX", plays: 1 }]);
  assert.equal(all.recent[0].source, "movviz");
  assert.equal(all.recent[0].percent, 90);
  assert.equal(all.byDay.length, 7);

  const onlyPlex = computeStats({ period: 7, userId, source: "plex" });
  assert.equal(onlyPlex.totals.plays, 1);
  assert.equal(onlyPlex.recent[0].tmdbId, 990_002);

  // Même titre, mais séparé de plus de 4 h : une relecture Plex distincte compte.
  recordUserContextEvent({
    ...base, eventType: "watched_marked", source: "plex_history", sourceEventId: `p3-${nonce}`,
    tmdbId: 990_001, occurredAt: now - 30 * HOUR,
  });
  assert.equal(computeStats({ period: 7, userId }).totals.plays, 3);
});
