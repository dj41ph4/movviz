import test from "node:test";
import assert from "node:assert/strict";
import {
  isAudioCodecSupported,
  shouldForceAudioTranscode,
  type CodecCapabilities,
} from "../src/lib/player/webcodecs.ts";

function caps(overrides: Partial<CodecCapabilities> = {}): CodecCapabilities {
  return {
    hevc: true, av1: true, h264: true,
    ac3: false, eac3: false, aac: true, opus: true, flac: true, mp3: true,
    mseAc3: false, mseEac3: false, mseMp3: true,
    webcodecsAvailable: true, mediaCapabilitiesAvailable: true,
    hevcMain10: true, av1Main10: true, hevc4k: true, av1_4k: true, h264_4k: true,
    ...overrides,
  };
}

test("MSE AC-3 support never masquerades as native direct support", () => {
  const c = caps({ ac3: false, mseAc3: true });
  assert.equal(isAudioCodecSupported("ac3", c), false);
  assert.equal(shouldForceAudioTranscode("ac3", c), false);
});

test("native AC-3 never authorizes unsupported MSE copy", () => {
  const c = caps({ ac3: true, mseAc3: false });
  assert.equal(isAudioCodecSupported("ac-3", c), true);
  assert.equal(shouldForceAudioTranscode("ac-3", c), true);
});

test("E-AC3 DTS TrueHD stay audio-transcode candidates", () => {
  const c = caps({ eac3: true, mseEac3: true });
  assert.equal(shouldForceAudioTranscode("eac3", c), true);
  assert.equal(shouldForceAudioTranscode("dts", c), true);
  assert.equal(shouldForceAudioTranscode("truehd", c), true);
});

test("AAC remains native and copyable", () => {
  const c = caps();
  assert.equal(isAudioCodecSupported("aac", c), true);
  assert.equal(shouldForceAudioTranscode("aac", c), false);
});
