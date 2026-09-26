import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-yt-"));
const { excludePortrait } = await import("../src/lib/metadata/youtubeOrientation.ts");

test("a YouTube check that never answers no longer holds a title page: kept after 0.4 s", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch; // never answers
  try {
    const t0 = Date.now();
    const kept = await excludePortrait(["slow1", "slow2"]);
    assert.deepEqual(kept, ["slow1", "slow2"], "unknown = kept, as with any failure");
    assert.ok(Date.now() - t0 < 1000, `waited ${Date.now() - t0} ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed check is not retried at every opening", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error("network"); }) as typeof fetch;
  try {
    await excludePortrait(["broken"]);
    await excludePortrait(["broken"]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
