import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, endSession } from "../src/lib/playback/engine/sessionManager.ts";
import type { PlaybackPlan } from "../src/lib/playback/engine/playbackPlan.ts";

const plan: PlaybackPlan = {
  mode: "DIRECT_STREAM",
  containerAction: "REMUX",
  targetContainer: "mp4",
  videoAction: "COPY",
  audioAction: "TRANSCODE",
  targetAudioCodec: "aac",
  subtitleAction: "NONE",
  protocol: "PROGRESSIVE",
  reasons: ["AUDIO_CODEC_UNSUPPORTED"],
};

test("playback session persists the exact Plex raw source selected before planning", () => {
  const s = createSession({
    userId: "u1", deviceId: "d1", clientType: "desktop-web", mediaId: "movie-1",
    source: {
      type: "plex_raw",
      uri: "http://plex/library/parts/42/file.mkv",
      headers: { "X-Plex-Token": "secret" },
      ratingKey: "123",
      sourceKey: "plex:123",
    },
    mode: plan.mode, videoAction: plan.videoAction, audioAction: plan.audioAction,
    subtitleAction: plan.subtitleAction, plan, selectedAudio: 2,
  });
  assert.equal(s.source.type, "plex_raw");
  if (s.source.type === "plex_raw") {
    assert.equal(s.source.ratingKey, "123");
    assert.equal(s.source.uri.endsWith("file.mkv"), true);
    assert.equal(s.source.headers["X-Plex-Token"], "secret");
  }
  assert.equal(s.selectedAudio, 2);
  assert.equal(s.plexFallbackUsed, false);
  endSession(s.sessionId);
});

test("local playback session persists the resolved local path", () => {
  const s = createSession({
    userId: "u2", deviceId: "d2", clientType: "desktop-web", mediaId: "movie-2",
    source: { type: "local", uri: "/media/movie.mkv", localPath: "/media/movie.mkv", sourceKey: "local" },
    mode: "DIRECT_PLAY", videoAction: "COPY", audioAction: "COPY", subtitleAction: "NONE",
    plan: { ...plan, mode: "DIRECT_PLAY", containerAction: "COPY", audioAction: "COPY", reasons: [] },
  });
  assert.equal(s.source.type, "local");
  if (s.source.type === "local") assert.equal(s.source.localPath, "/media/movie.mkv");
  endSession(s.sessionId);
});
