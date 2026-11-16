import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-lock-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const { withKeyLock } = await import("../src/lib/library/locks.ts");
const { getSearchLog } = await import("../src/lib/diagnostic/searchLog.ts");
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

test("the lock still serialises, returns results and survives a failing holder", async () => {
  const order: string[] = [];
  const a = withKeyLock("series:x", async () => { order.push("a1"); await new Promise((r) => setImmediate(r)); order.push("a2"); return 1; });
  const b = withKeyLock("series:x", async () => { order.push("b"); throw new Error("boom"); });
  const c = withKeyLock("series:x", async () => { order.push("c"); return 3; });
  const other = withKeyLock("series:y", async () => { order.push("y"); return 9; });
  assert.equal(await a, 1);
  await assert.rejects(b, /boom/);
  assert.equal(await c, 3);
  assert.equal(await other, 9);
  assert.deepEqual(order.filter((o) => o !== "y"), ["a1", "a2", "b", "c"]);
});

test("a caller kept waiting a full minute writes who holds the lock, once — and nothing when locks are released normally", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  try {
    let release!: () => void;
    const holder = withKeyLock("series:stuck", () => new Promise<void>((resolve) => { release = resolve; }));
    const waiter = withKeyLock("series:stuck", async () => "got it");
    const quick = withKeyLock("series:free", async () => "ok");
    assert.equal(await quick, "ok");
    await flush();
    mock.timers.tick(59_000);
    await flush();
    assert.equal(getSearchLog().filter((l) => l.step === "lock.wait").length, 0);
    mock.timers.tick(2_000);
    await flush();
    const lines = getSearchLog().filter((l) => l.step === "lock.wait");
    assert.equal(lines.length, 1, "one line: the waiter (the holder itself and the released lock say nothing)");
    assert.match(lines[0].message, /series:stuck/);
    assert.match(lines[0].message, /tenu depuis 6\d s par/);
    release();
    await holder;
    assert.equal(await waiter, "got it");
    mock.timers.tick(120_000);
    await flush();
    assert.equal(getSearchLog().filter((l) => l.step === "lock.wait").length, 1);
  } finally {
    mock.timers.reset();
  }
});
