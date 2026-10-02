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
database.getUserContextDb().close();
console.log("Production bundle: SQLite OK; legacy views/dates preserved; users isolated; explicit unwatched preserved.");
