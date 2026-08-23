import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSession,
  getSession,
  touchSession,
  recordFallbackAttempt,
  setTranscoderPid,
  onSessionCleanup,
  endSession,
  sweepExpiredSessions,
} from "../src/lib/playback/engine/sessionManager.ts";

function baseInput(mediaId: string) {
  return {
    userId: "u1",
    deviceId: "d1",
    clientType: "desktop-web" as const,
    mediaId,
    mode: "DIRECT_PLAY" as const,
    videoAction: "COPY" as const,
    audioAction: "COPY" as const,
    subtitleAction: "NONE" as const,
  };
}

test("createSession populates every §35 field and is retrievable via getSession", () => {
  const session = createSession(baseInput("m1"));
  assert.match(session.sessionId, /^pbs_/);
  assert.equal(session.userId, "u1");
  assert.equal(session.mediaId, "m1");
  assert.equal(session.fallbackCount, 0);
  assert.equal(session.transcoderPid, null);
  assert.equal(session.position, 0);
  assert.equal(getSession(session.sessionId)?.sessionId, session.sessionId);
});

test("a session created directly in PLEX_FALLBACK mode starts with plexFallbackUsed already true", () => {
  const session = createSession({ ...baseInput("m2"), mode: "PLEX_FALLBACK" });
  assert.equal(session.plexFallbackUsed, true);
});

test("a session created in a normal mode starts with plexFallbackUsed false", () => {
  const session = createSession(baseInput("m3"));
  assert.equal(session.plexFallbackUsed, false);
});

test("touchSession updates lastActivity and, when given, position", async () => {
  const session = createSession(baseInput("m4"));
  const firstActivity = session.lastActivity;
  await new Promise((r) => setTimeout(r, 5));
  const touched = touchSession(session.sessionId, 42000);
  assert.ok(touched);
  assert.ok(touched!.lastActivity > firstActivity);
  assert.equal(touched!.position, 42000);
});

test("touchSession without a position leaves the existing position untouched", () => {
  const session = createSession(baseInput("m5"));
  touchSession(session.sessionId, 10000);
  const touched = touchSession(session.sessionId);
  assert.equal(touched!.position, 10000);
});

test("touchSession on an unknown sessionId returns null, never throws", () => {
  assert.equal(touchSession("does-not-exist", 1000), null);
});

test("recordFallbackAttempt increments fallbackCount and updates mode, sets plexFallbackUsed only when the new mode is PLEX_FALLBACK", () => {
  const session = createSession(baseInput("m6"));
  const step1 = recordFallbackAttempt(session.sessionId, "REMUX");
  assert.equal(step1!.fallbackCount, 1);
  assert.equal(step1!.mode, "REMUX");
  assert.equal(step1!.plexFallbackUsed, false);
  const step2 = recordFallbackAttempt(session.sessionId, "PLEX_FALLBACK");
  assert.equal(step2!.fallbackCount, 2);
  assert.equal(step2!.plexFallbackUsed, true);
});

test("setTranscoderPid stores the pid on the session", () => {
  const session = createSession(baseInput("m7"));
  setTranscoderPid(session.sessionId, 4242);
  assert.equal(getSession(session.sessionId)!.transcoderPid, 4242);
});

test("endSession removes the session and fires registered cleanup hooks exactly once", () => {
  const session = createSession(baseInput("m8"));
  const seen: string[] = [];
  onSessionCleanup((s) => {
    if (s.sessionId === session.sessionId) seen.push(s.sessionId);
  });
  const removed = endSession(session.sessionId);
  assert.equal(removed, true);
  assert.equal(getSession(session.sessionId), null);
  assert.deepEqual(seen, [session.sessionId]);
  // Ending an already-gone session is a no-op, not an error.
  assert.equal(endSession(session.sessionId), false);
});

test("§36: sweepExpiredSessions purges only sessions past the TTL and fires cleanup hooks for them", () => {
  const stale = createSession(baseInput("m9-stale"));
  const fresh = createSession(baseInput("m9-fresh"));
  const swept: string[] = [];
  onSessionCleanup((s) => {
    if (s.sessionId === stale.sessionId || s.sessionId === fresh.sessionId) swept.push(s.sessionId);
  });

  const farFuture = stale.lastActivity + 10 * 60 * 1000; // default TTL is 5 min
  // Simulate "fresh was active right at the sweep instant" — mutating the
  // live tracked object directly (getSession returns the real reference,
  // not a copy), since touchSession() can only stamp real wall-clock time.
  getSession(fresh.sessionId)!.lastActivity = farFuture;
  const purged = sweepExpiredSessions(farFuture);

  assert.ok(purged >= 1);
  assert.equal(getSession(stale.sessionId), null);
  assert.ok(swept.includes(stale.sessionId));
  assert.equal(getSession(fresh.sessionId)?.sessionId, fresh.sessionId);
  assert.ok(!swept.includes(fresh.sessionId));
});

test("MOVVIZ_PLAYBACK_SESSION_TTL_MS overrides the default TTL", () => {
  const session = createSession(baseInput("m10"));
  const prior = process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS;
  process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS = "1000"; // 1s — far shorter than the 5min default
  try {
    const purged = sweepExpiredSessions(session.lastActivity + 5000);
    assert.ok(purged >= 1);
    assert.equal(getSession(session.sessionId), null);
  } finally {
    if (prior === undefined) delete process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS;
    else process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS = prior;
  }
});
