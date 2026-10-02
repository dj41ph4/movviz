import { test } from "node:test";
import assert from "node:assert/strict";
import { ProgressiveCache } from "@/lib/recommender/progressiveCache";
import { getCache } from "@/lib/cache/registry";
import { applyWatchDecision } from "@/lib/userContext/watchBridge";
import { buildSeeds } from "@/lib/recommender/seedBuilder";
import { getRecommendationPool } from "@/lib/recommender/engine";
import { selectProviderCandidates } from "@/lib/recommender/providerRelations";
import type { MetaSearchResult } from "@/lib/metadata/types";

const item = (id: number): MetaSearchResult => ({ tmdbId: id, type: "movie", title: `Film ${id}`,
  posterPath: null, backdropPath: null, overview: "", rating: 7, year: 2020, releaseDate: "2020-01-01" });

test("all 45 historical titles contribute, including after seed 20; profiles remain isolated", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 200, headers: { "content-type": "application/json" } }));
  const userId = `history-pool-${Date.now()}`;
  const other = `${userId}-other`;
  const cache = getCache("historyRelations:v1", 60_000);
  for (let id = 1000; id < 1045; id++) {
    applyWatchDecision({ userId, tmdbId: id, mediaType: "movie", state: "watched", source: "plex_history", occurredAt: 1000 });
    cache.set(`movie:${id}`, { recommendations: [item(id + 8000)], similar: [], bridge: [] });
  }
  applyWatchDecision({ userId: other, tmdbId: 2000, mediaType: "movie", state: "watched", source: "plex_history", occurredAt: 1000 });
  cache.set("movie:2000", { recommendations: [item(99999)], similar: [], bridge: [] });
  assert.equal(buildSeeds(userId, "movie").length, 45);
  const pool = await getRecommendationPool(userId, "movie");
  assert.equal(pool.length, 45);
  assert.ok(pool.some((candidate) => candidate.tmdbId === 9044));
  assert.ok(!pool.some((candidate) => candidate.tmdbId === 99999));
  assert.deepEqual((await getRecommendationPool(other, "movie")).map((c) => c.tmdbId), [99999]);
  applyWatchDecision({ userId, tmdbId: 9044, mediaType: "movie", state: "watched", source: "movviz_manual", occurredAt: Date.now() });
  cache.set("movie:9044", { recommendations: [], similar: [], bridge: [] });
  assert.ok(!(await getRecommendationPool(userId, "movie")).some((c) => c.tmdbId === 9044));
});

test("progressive transport eventually covers every key, deduplicates requests and limits concurrency", async () => {
  const data = new Map<string, number>();
  let active = 0; let peak = 0; let calls = 0;
  const queue = new ProgressiveCache((key) => data.get(key), (key, value: number) => data.set(key, value), async (key) => {
    active++; peak = Math.max(peak, active); calls++;
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--; return Number(key);
  }, 2);
  const keys = Array.from({ length: 45 }, (_, i) => String(i));
  await Promise.all([queue.read(keys, 0), queue.read(keys, 0)]);
  while (queue.hasPending(keys)) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(data.size, 45); assert.equal(calls, 45); assert.equal(peak, 2);
});

test("provider selection filters the complete common pool, not its first 200, and respects region/type", () => {
  const pool = Array.from({ length: 250 }, (_, i) => item(i));
  const memberships = new Map([["movie:BE:249", [337]], ["movie:US:1", [337]], ["series:BE:2", [337]]]);
  assert.deepEqual(selectProviderCandidates(pool, memberships, "movie", "BE", 337).map((c) => c.tmdbId), [249]);
});

test("failed public metadata is not cached as a successful empty result", async () => {
  const data = new Map<string, number>(); let calls = 0;
  const queue = new ProgressiveCache((key) => data.get(key), (key, value: number) => data.set(key, value), async () => { calls++; throw new Error("offline"); });
  await queue.read(["1"]);
  assert.equal(data.size, 0);
  await queue.read(["1"]);
  assert.equal(calls, 1, "retry is backed off, not a busy failure loop");
});
