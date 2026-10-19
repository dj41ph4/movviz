import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("opening a title schedules its Plex reconcile in the background, at most once a minute", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-instant-open-"));
  const previous = process.env.MOVVIZ_CONFIG_DIR;
  process.env.MOVVIZ_CONFIG_DIR = sandbox;
  try {
    const { scheduleSeriesPlaybackReconcile } = await import("@/lib/plex/librarySync");
    const started = Date.now();
    assert.equal(scheduleSeriesPlaybackReconcile("sr_unknown"), true); // started, returns immediately
    assert.ok(Date.now() - started < 40, "the call must not wait for the reconcile");
    assert.equal(scheduleSeriesPlaybackReconcile("sr_unknown"), true); // still running or about to
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(scheduleSeriesPlaybackReconcile("sr_unknown"), false); // finished: throttled for a minute
    assert.equal(scheduleSeriesPlaybackReconcile("sr_other"), true); // another series is independent
    await new Promise((resolve) => setTimeout(resolve, 250));
  } finally {
    if (previous === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previous;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});
