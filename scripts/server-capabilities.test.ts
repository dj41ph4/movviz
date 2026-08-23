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

test("hardware acceleration flags reflect compiled encoder/decoder name suffixes", async () => {
  const caps = await detectServerCapabilities();
  // Confirmed live on this dev machine (no real NVIDIA/Intel hardware) that
  // ffmpeg still lists these compiled-in names — so these should read true
  // here even without matching physical hardware, per the file's own caveat.
  assert.equal(caps.hardwareAcceleration.nvenc, caps.videoEncoders.some((n) => n.endsWith("_nvenc")));
  assert.equal(caps.hardwareAcceleration.nvdec, caps.videoDecoders.some((n) => n.endsWith("_cuvid")));
  assert.equal(caps.hardwareAcceleration.qsv, [...caps.videoEncoders, ...caps.videoDecoders].some((n) => n.endsWith("_qsv")));
  // videotoolbox is macOS-only — must be false on this Windows box.
  assert.equal(caps.hardwareAcceleration.videotoolbox, false);
});

test("does not misparse the encoder/decoder flag column's 'D' (direct rendering) as a type letter", async () => {
  const caps = await detectServerCapabilities();
  // Every parsed name must be a real codec/implementation name, never a
  // stray flag-column artifact like "V.....", ".D....", etc.
  for (const name of [...caps.videoEncoders, ...caps.videoDecoders, ...caps.audioEncoders, ...caps.audioDecoders]) {
    assert.doesNotMatch(name, /^[.VASD]{2,6}$/, `suspicious parsed name: "${name}"`);
  }
});
