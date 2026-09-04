import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// This module resolves its data directory at import time. Isolate it from a
// real Movviz install so the test exercises the durable session update only.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-playback-duration-"));
process.env.MOVVIZ_CONFIG_DIR = tempDir;
const { openPlaybackSession, getPlaybackSession, getPlaybackProgress, updatePlaybackDuration, applyHeartbeat, applySeek, stopPlayback } =
  await import("../src/lib/playback/progressStore.ts");

test("FFmpeg metadata replaces the provisional playback duration before progress is saved", () => {
  const { session, progress } = openPlaybackSession("test-user", {
    ratingKey: "plex-499264",
    mediaId: "movviz-rip",
    mediaType: "movie",
    // This reproduces the old client fallback used before stream info arrives.
    durationMs: 1_000_000,
  });
  assert.equal(progress.durationMs, 1_000_000);

  const updated = updatePlaybackDuration(session.id, 6_780_000);
  assert.ok(updated);
  assert.equal(updated.durationMs, 6_780_000);
  assert.equal(getPlaybackSession(session.id)?.durationMs, 6_780_000);
  assert.equal(getPlaybackProgress("test-user", "plex-499264", "movviz-rip")?.durationMs, 6_780_000);
  // Feature-film fallback is five minutes before the end, not five minutes
  // before the previous provisional 16:40 duration.
  assert.equal(updated.completionBoundaryMs, 6_480_000);
});

test("stopping in end credits completes playback without waiting for another heartbeat", () => {
  const { session } = openPlaybackSession("test-user", {
    ratingKey: "plex-credits",
    mediaId: "movviz-credits",
    mediaType: "movie",
    durationMs: 7_200_000,
  });
  // Accumulate the minimum real viewing time without a seek-sized jump.
  applyHeartbeat(session.id, { sequence: 1, positionMs: 30_000, isPlaying: true, nowMs: session.startedAt + 30_000 });
  const afterMinute = applyHeartbeat(session.id, { sequence: 2, positionMs: 60_000, isPlaying: true, nowMs: session.startedAt + 60_000 });
  assert.equal(afterMinute.actualPlayedMs, 60_000);
  assert.equal(afterMinute.completionBoundaryMs, 6_900_000);

  // The UI sends this position as it unmounts. Previously stopPlayback
  // ignored the boundary and left the old resume card behind.
  applySeek(session.id, 6_900_000);
  const stopped = stopPlayback(session.id, 6_900_000);
  assert.equal(stopped.watched, true);
  assert.equal(stopped.resumeOffsetMs, null);
  assert.equal(getPlaybackProgress("test-user", "plex-credits", "movviz-credits")?.watched, true);
});

test.after(async () => {
  // fsJsonCache coalesces persistence for 300 ms. Let that final write settle
  // before deleting the disposable directory, otherwise the test would leave
  // a misleading asynchronous ENOENT warning after all assertions passed.
  await new Promise((resolve) => setTimeout(resolve, 350));
  // `tempDir` is created above with this exact unique prefix. Keep the
  // recursive cleanup constrained to that disposable test directory.
  const expectedPrefix = path.join(os.tmpdir(), "movviz-playback-duration-");
  if (tempDir.startsWith(expectedPrefix) && path.parse(tempDir).root !== tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
    } catch (error) {
      // Windows can briefly retain an async cache write handle. The directory
      // is disposable and the failed cleanup must not turn a passing test
      // into a false negative.
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  }
});
