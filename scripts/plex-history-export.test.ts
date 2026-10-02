import { test } from "node:test";
import assert from "node:assert/strict";
import { addUser } from "@/lib/auth/store";
import type { User } from "@/lib/auth/types";
import type { PlexUserContext } from "@/lib/plex/plexUserContext";
import { queuePlexWatchHistoryExport } from "@/lib/plex/historyExport";
import { applyWatchDecision, getCurrentWatchStateAt } from "@/lib/userContext/watchBridge";
import { getUserMediaSyncStates } from "@/lib/userContext/syncState";
import { getUserContextHealth } from "@/lib/userContext/database";

test("explicit export queues only the target's watched history without changing dates or other users", async (t) => {
  if (getUserContextHealth().database !== "ok") { t.skip("SQLite unavailable"); return; }
  const id = `export-${Date.now()}`;
  addUser({ id, username: id, plexId: "8898531", role: "user", status: "approved" } as User);
  const ctx = { movvizUserId: id, authSource: "shared", serverToken: "test-personal-token",
    localAccountId: 8898531, plexAccountId: "8898531" } as PlexUserContext;
  const globals = globalThis as typeof globalThis & {
    __movvizPlexUserContextCache?: Map<string, { ctx: PlexUserContext; expiresAt: number }>;
  };
  globals.__movvizPlexUserContextCache ??= new Map();
  globals.__movvizPlexUserContextCache.set(id, { ctx, expiresAt: Date.now() + 60_000 });
  const at = Date.UTC(2024, 0, 1);
  applyWatchDecision({ userId: id, tmdbId: 123, mediaType: "movie", state: "watched", source: "plex_history", occurredAt: at });
  applyWatchDecision({ userId: id, tmdbId: 124, mediaType: "movie", state: "unwatched", source: "movviz_manual", occurredAt: at });
  applyWatchDecision({ userId: `${id}-other`, tmdbId: 125, mediaType: "movie", state: "watched", source: "plex_history", occurredAt: at });
  const before = getCurrentWatchStateAt({ userId: id, tmdbId: 123, mediaType: "movie" });
  const dry = await queuePlexWatchHistoryExport(id, false);
  assert.equal(dry.queued, 1);
  assert.equal(getUserMediaSyncStates(id).length, 0);
  const applied = await queuePlexWatchHistoryExport(id, true);
  assert.equal(applied.localAccountId, 8898531);
  assert.equal(applied.queued, 1);
  const states = getUserMediaSyncStates(id);
  assert.equal(states.length, 1);
  assert.equal(states[0].stateKey, `${id}:movie:123`);
  assert.equal(states[0].desiredState, "watched");
  assert.deepEqual(getCurrentWatchStateAt({ userId: id, tmdbId: 123, mediaType: "movie" }), before);
  assert.equal(getUserMediaSyncStates(`${id}-other`).length, 0);
  globals.__movvizPlexUserContextCache.set(id, { ctx: { ...ctx, localAccountId: 1 }, expiresAt: Date.now() + 60_000 });
  await assert.rejects(queuePlexWatchHistoryExport(id, true), /unsafe_plex_target_identity/);
  globals.__movvizPlexUserContextCache.delete(id);
});
