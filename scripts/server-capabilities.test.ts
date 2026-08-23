import { test } from "node:test";
import assert from "node:assert/strict";
import { detectServerCapabilities } from "../src/lib/playback/engine/serverCapabilities.detect.ts";

// Runs against this machine's real ffmpeg (winget Gyan build, confirmed
// present) — not a mock. Ground truth for the assertions below was
// established live via `ffmpeg -hide_banner -encoders/-decoders/-hwaccels`
// before writing the parser.

test("detects real ffmpeg availability and common software codecs", async () => {
  const caps = await detectServerCapabilities();
  assert.equal(caps.ffmpegAvailable, true);
  assert.ok(caps.videoEncoders.includes("libx264"));
  assert.ok(caps.videoEncoders.includes("libx265"));
  assert.ok(caps.videoDecoders.includes("h264"));
  assert.ok(caps.audioEncoders.includes("aac"));
});

test("memoizes across calls (same object reference)", async () => {
  const a = await detectServerCapabilities();
  const b = await detectServerCapabilities();
  assert.equal(a, b);
});

test("hardware acceleration flags reflect a REAL verification encode, not just the compiled name list", async () => {
  const caps = await detectServerCapabilities();
  // This sandbox has a real NVIDIA GPU (confirmed live: a 320x240 h264_nvenc
  // test encode genuinely exits 0) but no Intel/AMD hardware (h264_qsv fails
  // with "Error creating a MFX session", h264_amf fails with "DLL amfrt64.dll
  // failed to open") and vaapi is Linux-only (no /dev/dri on Windows) — so
  // nvenc must verify true while qsv/amf/vaapi must verify false, even though
  // ffmpeg's own -encoders list claims all four are compiled in. This is
  // exactly the production bug this fix exists for: av1_qsv was compiled in
  // on the Synology's ffmpeg build, got picked for a real transcode, and
  // failed at runtime with no QSV device actually present.
  assert.equal(caps.hardwareAcceleration.nvenc, true);
  assert.equal(caps.hardwareAcceleration.qsv, false);
  assert.equal(caps.hardwareAcceleration.amf, false);
  assert.equal(caps.hardwareAcceleration.vaapi, false);
  // videotoolbox is macOS-only — must be false on this Windows box.
  assert.equal(caps.hardwareAcceleration.videotoolbox, false);
});

test("videoEncoders drops unverified hardware names but keeps verified ones and all software encoders", async () => {
  const caps = await detectServerCapabilities();
  // nvenc genuinely works here — its compiled names must survive the filter.
  assert.ok(caps.videoEncoders.includes("h264_nvenc"));
  // qsv/amf/vaapi don't work here — their compiled names must NOT survive,
  // even though a raw `ffmpeg -encoders` on this same machine lists them.
  assert.ok(!caps.videoEncoders.some((n) => n.endsWith("_qsv")));
  assert.ok(!caps.videoEncoders.some((n) => n.endsWith("_amf")));
  assert.ok(!caps.videoEncoders.some((n) => n.endsWith("_vaapi")));
  // Software encoders never go through verification — always kept.
  assert.ok(caps.videoEncoders.includes("libx264"));
  assert.ok(caps.videoEncoders.includes("libx265"));
});

test("does not misparse the legend lines (\" V..... = Video\" etc.) as a bogus \"=\" entry — found via a real end-to-end run", async () => {
  const caps = await detectServerCapabilities();
  assert.ok(!caps.videoEncoders.includes("="));
  assert.ok(!caps.videoDecoders.includes("="));
  assert.ok(!caps.audioEncoders.includes("="));
  assert.ok(!caps.audioDecoders.includes("="));
});

test("does not misparse the encoder/decoder flag column's 'D' (direct rendering) as a type letter", async () => {
  const caps = await detectServerCapabilities();
  // Every parsed name must be a real codec/implementation name, never a
  // stray flag-column artifact like "V.....", ".D....", etc.
  for (const name of [...caps.videoEncoders, ...caps.videoDecoders, ...caps.audioEncoders, ...caps.audioDecoders]) {
    assert.doesNotMatch(name, /^[.VASD]{2,6}$/, `suspicious parsed name: "${name}"`);
  }
});
