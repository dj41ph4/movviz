from pathlib import Path
p = Path('scripts/playback-session-manager.test.ts')
s = p.read_text(encoding='utf-8')
s = s.replace(
'''test("a session created directly in PLEX_FALLBACK mode starts with plexFallbackUsed already true", () => {
  const session = createSession({ ...baseInput("m2"), mode: "PLEX_FALLBACK" });
  assert.equal(session.plexFallbackUsed, true);
});''',
'''test("legacy PLEX_FALLBACK mode never activates Plex Transcoder state", () => {
  const session = createSession({ ...baseInput("m2"), mode: "PLEX_FALLBACK" });
  assert.equal(session.plexFallbackUsed, false);
});''')
s = s.replace(
'''test("recordFallbackAttempt increments fallbackCount and updates mode, sets plexFallbackUsed only when the new mode is PLEX_FALLBACK", () => {
  const session = createSession(baseInput("m6"));
  const step1 = recordFallbackAttempt(session.sessionId, "REMUX");
  assert.equal(step1!.fallbackCount, 1);
  assert.equal(step1!.mode, "REMUX");
  assert.equal(step1!.plexFallbackUsed, false);
  const step2 = recordFallbackAttempt(session.sessionId, "PLEX_FALLBACK");
  assert.equal(step2!.fallbackCount, 2);
  assert.equal(step2!.plexFallbackUsed, true);
});''',
'''test("recordFallbackAttempt updates mode/count without ever activating Plex Transcoder state", () => {
  const session = createSession(baseInput("m6"));
  const step1 = recordFallbackAttempt(session.sessionId, "REMUX");
  assert.equal(step1!.fallbackCount, 1);
  assert.equal(step1!.mode, "REMUX");
  assert.equal(step1!.plexFallbackUsed, false);
  const step2 = recordFallbackAttempt(session.sessionId, "UNSUPPORTED");
  assert.equal(step2!.fallbackCount, 2);
  assert.equal(step2!.mode, "UNSUPPORTED");
  assert.equal(step2!.plexFallbackUsed, false);
});''')
if 'starts with plexFallbackUsed already true' in s or 'sets plexFallbackUsed only when' in s:
    raise SystemExit('obsolete Plex fallback expectations remain')
p.write_text(s, encoding='utf-8')
