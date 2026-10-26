import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-resume-zero-"));
process.env.MOVVIZ_CONFIG_DIR = tempDir;
process.env.MOVVIZ_TMDB_API_KEY = "";
const { openPlaybackSession, applyHeartbeat, applySeek, stopPlayback, getPlaybackProgress } = await import("../src/lib/playback/progressStore.ts");

const MOVIE = { ratingKey: "movie-zero", mediaType: "movie" as const, durationMs: 7_200_000 };

function watchUntil40Minutes(userId: string) {
  const { session } = openPlaybackSession(userId, MOVIE);
  applySeek(session.id, 2_340_000);
  applyHeartbeat(session.id, { sequence: 1, positionMs: 2_370_000, isPlaying: true, nowMs: session.startedAt + 30_000 });
  applyHeartbeat(session.id, { sequence: 2, positionMs: 2_385_000, isPlaying: true, nowMs: session.startedAt + 45_000 });
  applyHeartbeat(session.id, { sequence: 3, positionMs: 2_400_000, isPlaying: true, nowMs: session.startedAt + 61_000 });
  stopPlayback(session.id, 2_400_000);
  assert.equal(getPlaybackProgress(userId, MOVIE.ratingKey)?.resumeOffsetMs, 2_400_000);
}

test("closing the player on the resume prompt keeps the resume point", () => {
  watchUntil40Minutes("prompt-user");
  const { session, progress } = openPlaybackSession("prompt-user", MOVIE);
  assert.equal(progress.resumeOffsetMs, 2_400_000);
  stopPlayback(session.id, 0);
  assert.equal(getPlaybackProgress("prompt-user", MOVIE.ratingKey)?.resumeOffsetMs, 2_400_000);
});

test("a stream lost after resuming cannot drag the resume point back to 0", () => {
  watchUntil40Minutes("lost-user");
  const { session } = openPlaybackSession("lost-user", MOVIE);
  applySeek(session.id, 2_400_000);
  for (let i = 1; i <= 8; i++) {
    applyHeartbeat(session.id, { sequence: i, positionMs: 2_400_000 + i * 10_000, isPlaying: true, nowMs: session.startedAt + i * 10_000 });
  }
  // The element was emptied by the error: its heartbeat and stop say 0.
  applyHeartbeat(session.id, { sequence: 9, positionMs: 0, isPlaying: false, nowMs: session.startedAt + 90_000 });
  stopPlayback(session.id, 0);
  assert.equal(getPlaybackProgress("lost-user", MOVIE.ratingKey)?.resumeOffsetMs, 2_480_000);
});

test("restarting from the beginning on purpose still moves the resume point", () => {
  watchUntil40Minutes("restart-user");
  const { session } = openPlaybackSession("restart-user", MOVIE);
  for (let i = 1; i <= 9; i++) {
    applyHeartbeat(session.id, { sequence: i, positionMs: i * 10_000, isPlaying: true, nowMs: session.startedAt + i * 10_000 });
  }
  stopPlayback(session.id, 95_000);
  assert.equal(getPlaybackProgress("restart-user", MOVIE.ratingKey)?.resumeOffsetMs, 95_000);
});
