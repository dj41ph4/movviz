import test from "node:test";
import assert from "node:assert/strict";
import { plexTimeToMs } from "@/lib/plex/client";
import { getWatchStatus, recordWatched } from "@/lib/plex/watchStore";

test("Plex history dates (Unix seconds) become milliseconds; ms values pass through", () => {
  // Seen on the Plex accounts diagnostic: history « vu le » in January 1970.
  assert.equal(plexTimeToMs(1_790_336_770), 1_790_336_770_000);
  assert.equal(plexTimeToMs(1_790_336_770_000), 1_790_336_770_000);
  assert.equal(plexTimeToMs(undefined), undefined);
  assert.equal(new Date(plexTimeToMs(1_790_336_770)!).getUTCFullYear(), 2026);
});

test("an older view never pushes a show back down the recently watched list", () => {
  const userId = `test-recent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  recordWatched(userId, { tmdbId: 9_900_001, type: "series", title: "En cours", at: now });
  recordWatched(userId, { tmdbId: 9_900_002, type: "movie", title: "Hier", at: now - 86_400_000 });
  // An old episode of the show being watched right now (catch-up, imported history).
  recordWatched(userId, { tmdbId: 9_900_001, type: "series", title: "En cours", at: now - 365 * 86_400_000 });
  const recent = getWatchStatus(userId)?.recent ?? [];
  assert.deepEqual(recent.map((r) => r.tmdbId), [9_900_001, 9_900_002]);
  assert.equal(recent[0].at, now);
});

test("dates stored in seconds are repaired once, real ms dates are never touched", async () => {
  const { repairSecondTimestamps, setWatchedEpisodes } = await import("@/lib/plex/watchStore");
  const userId = `test-repair-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nowMs = Date.now();
  // A view synced before the fix: Unix seconds.
  recordWatched(userId, { tmdbId: 9_900_010, type: "series", title: "Ancienne synchro", at: Math.floor(nowMs / 1000) - 60 });
  recordWatched(userId, { tmdbId: 9_900_011, type: "movie", title: "Vu en ms", at: nowMs - 120_000 });
  setWatchedEpisodes(userId, [{ tmdbId: 9_900_012, season: 1, episode: 1, watchedAt: 1_700_000_000 }], true, "Épisode", "plex_history");
  assert.ok(repairSecondTimestamps() >= 2);
  const status = getWatchStatus(userId)!;
  const byId = new Map(status.recent!.map((r) => [r.tmdbId, r.at]));
  assert.equal(byId.get(9_900_010), (Math.floor(nowMs / 1000) - 60) * 1000);
  assert.equal(byId.get(9_900_011), nowMs - 120_000);
  assert.equal(status.recent![0].tmdbId, 9_900_010, "the repaired recent view is back on top");
  // Idempotent: a second pass changes nothing for this user.
  repairSecondTimestamps();
  assert.equal(new Map(getWatchStatus(userId)!.recent!.map((r) => [r.tmdbId, r.at])).get(9_900_010), (Math.floor(nowMs / 1000) - 60) * 1000);
});
