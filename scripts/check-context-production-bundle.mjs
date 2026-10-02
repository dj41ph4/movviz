import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

// Execute the real Webpack server bundle, not the TypeScript source: source
// tests could not catch createRequire being compiled into undefined.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-built-context-"));
process.env.MOVVIZ_CONFIG_DIR = directory;
process.env.MOVVIZ_CONTEXT_ENGINE_DISABLED = "0";
const at = 1_700_000_000_000;
fs.writeFileSync(path.join(directory, "plex-watch-status.json"), JSON.stringify([
  { userId: "alice", movies: [42, 99], movieWatchedAt: { 42: at, 99: at }, episodes: [{ tmdbId: 100, season: 2, episode: 3, at }], updatedAt: at },
  { userId: "bob", movies: [123], episodes: [], updatedAt: at },
]));
const require = createRequire(import.meta.url);
require(path.resolve(".next/server/app/api/plex/status/route.js"));
const runtime = require(path.resolve(".next/server/webpack-runtime.js"));
function bundledModule(marker) {
  const entry = Object.entries(runtime.m).find(([, factory]) => factory.toString().includes(marker));
  assert.ok(entry, `missing compiled module: ${marker}`);
  return runtime(entry[0]);
}
const database = bundledModule("function loadDatabaseSync()");
const bridgeExports = bundledModule("function getCanonicalWatchStatus(");
const bridge = Object.fromEntries(Object.values(bridgeExports).filter((value) => typeof value === "function").map((fn) => [fn.name, fn]));
assert.equal(database.getUserContextHealth().database, "ok", JSON.stringify(database.getUserContextHealth()));
assert.equal(bridge.applyWatchDecision({ userId: "alice", tmdbId: 99, mediaType: "movie", state: "unwatched", occurredAt: at + 1, source: "movviz_manual" }).accepted, true);
const alice = bridge.getCanonicalWatchStatus("alice");
assert.deepEqual(alice.movies, [42]);
assert.deepEqual(alice.episodes, [{ tmdbId: 100, season: 2, episode: 3, at }]);
assert.deepEqual(bridge.getCanonicalWatchStatus("bob").movies, [123]);
assert.equal(bridge.getCurrentWatchStateAt({ userId: "bob", tmdbId: 42, mediaType: "movie" }).state, "unknown");
assert.equal(bridge.getCurrentWatchStateAt({ userId: "alice", tmdbId: 99, mediaType: "movie" }).state, "unwatched");
const ingestExports = bundledModule("function upsertUserMediaState(");
const upsert = Object.values(ingestExports).find((fn) => typeof fn === "function" && fn.name === "upsertUserMediaState");
assert.ok(upsert);
assert.equal(upsert({ userId: "alice", tmdbId: 100, mediaType: "episode", seasonNumber: 2, episodeNumber: 4, positionMs: 120_000, durationMs: 1_000_000, progressRatio: 0.12, eligibleForResume: true, watched: false, updatedAt: at, progressUpdatedAt: at, progressSource: "test" }, { force: true }), true);
assert.equal(database.getUserContextDb().prepare("SELECT position_ms FROM user_media_state WHERE state_key = ?").get("alice:episode:100:2:4").position_ms, 120_000);
const storeExports = bundledModule("function syncLegacyWatchProjection(");
const store = Object.fromEntries(Object.values(storeExports).filter((value) => typeof value === "function").map((fn) => [fn.name, fn]));
assert.equal(bridge.applyWatchDecision({ userId: "alice", tmdbId: 777, mediaType: "movie", state: "watched", occurredAt: at + 2, source: "plex_history" }).accepted, true);
const eventCount = database.getUserContextDb().prepare("SELECT COUNT(*) AS n FROM context_events").get().n;
assert.equal(store.syncLegacyWatchProjection("alice"), true);
assert.ok(store.getWatchStatus("alice").movies.includes(777));
assert.ok(!store.getWatchStatus("alice").movies.includes(99));
assert.ok(!store.getWatchStatus("bob").movies.includes(777));
assert.equal(database.getUserContextDb().prepare("SELECT COUNT(*) AS n FROM context_events").get().n, eventCount);
database.getUserContextDb().close();
console.log("Production bundle: SQLite, progress writes, legacy mirror, dates and user isolation OK.");
