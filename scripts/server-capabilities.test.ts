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

// Les deux tests suivants supposaient la machine de dev de Seb (GPU NVIDIA,
// Windows) et échouaient partout ailleurs. Ils vérifient désormais la même
// règle sans dépendre du matériel : une famille d'encodeurs matériels n'est
// annoncée que si son encodage de vérification a réussi.
const HW_SUFFIX = { nvenc: "_nvenc", qsv: "_qsv", amf: "_amf", vaapi: "_vaapi", videotoolbox: "_videotoolbox" } as const;

test("hardware acceleration flags reflect a REAL verification encode, not just the compiled name list", async () => {
  const caps = await detectServerCapabilities();
  for (const [family, suffix] of Object.entries(HW_SUFFIX)) {
    const flag = caps.hardwareAcceleration[family as keyof typeof HW_SUFFIX];
    const kept = caps.videoEncoders.some((n) => n.endsWith(suffix));
    assert.equal(kept, flag, `${family}: flag=${flag} but encoders kept=${kept}`);
  }
  // videotoolbox n'existe que sur macOS, vaapi que sur Linux.
  if (process.platform !== "darwin") assert.equal(caps.hardwareAcceleration.videotoolbox, false);
  if (process.platform !== "linux") assert.equal(caps.hardwareAcceleration.vaapi, false);
});

test("videoEncoders drops unverified hardware names but keeps verified ones and all software encoders", async () => {
  const caps = await detectServerCapabilities();
  for (const [family, suffix] of Object.entries(HW_SUFFIX)) {
    if (!caps.hardwareAcceleration[family as keyof typeof HW_SUFFIX]) {
      assert.ok(!caps.videoEncoders.some((n) => n.endsWith(suffix)), `unverified ${family} encoder kept`);
    }
  }
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
