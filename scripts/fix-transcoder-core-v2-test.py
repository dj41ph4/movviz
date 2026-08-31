from pathlib import Path
p = Path('scripts/decide-playback.test.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('PLEX_FALLBACK only then', 'UNSUPPORTED, never Plex Transcoder')
s = s.replace('assert.equal(plan.mode, "PLEX_FALLBACK");', 'assert.equal(plan.mode, "UNSUPPORTED");')
s = s.replace('assert.ok(plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));', 'assert.ok(!plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));')
p.write_text(s, encoding='utf-8')
