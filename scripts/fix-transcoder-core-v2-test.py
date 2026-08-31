from pathlib import Path
p = Path('scripts/decide-playback.test.ts')
s = p.read_text(encoding='utf-8')
old = '''test("§74 Cas 4: total Movviz unavailability (no ffmpeg, video also needs transcoding) → PLEX_FALLBACK only then", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: FFMPEG_DOWN,
  });
  assert.equal(plan.mode, "PLEX_FALLBACK");
  assert.equal(plan.videoAction, "TRANSCODE");
});'''
new = '''test("§74 Cas 4: total Movviz transcoder unavailability never delegates to Plex Transcoder", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: FFMPEG_DOWN,
  });
  assert.equal(plan.mode, "UNSUPPORTED");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));
});'''
if old not in s:
    raise SystemExit('obsolete §74 Plex fallback test not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
