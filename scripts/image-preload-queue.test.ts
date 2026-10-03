import assert from "node:assert/strict";
import { test } from "node:test";
import { createImagePreloadQueue } from "../src/components/media/imagePreloadQueue";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("the queue never starts more than its global budget and drains every job", async () => {
  const queue = createImagePreloadQueue(2);
  const gates = Array.from({ length: 6 }, gate);
  const started: number[] = [];
  let active = 0, peak = 0;
  for (let i = 0; i < gates.length; i++) queue.enqueue({}, async () => {
    started.push(i); active++; peak = Math.max(peak, active);
    await gates[i].promise; active--;
  });
  await flush(); assert.deepEqual(started, [0, 1]); assert.equal(peak, 2);
  for (const hold of gates) { hold.resolve(); await flush(); assert.ok(active <= 2); }
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5]); assert.equal(peak, 2); assert.equal(active, 0);
});

test("closer waiting artwork starts first, with FIFO for equal distance", async () => {
  const queue = createImagePreloadQueue(1);
  const blocked = gate();
  const order: string[] = [];
  queue.enqueue({}, async () => { order.push("running"); await blocked.promise; });
  queue.enqueue({}, async () => { order.push("far"); }, 100);
  queue.enqueue({}, async () => { order.push("near-first"); }, 5);
  queue.enqueue({}, async () => { order.push("near-second"); }, 5);
  await flush(); assert.deepEqual(order, ["running"]);
  blocked.resolve(); await flush();
  assert.deepEqual(order, ["running", "near-first", "near-second", "far"]);
});

test("cancel removes waiting work and repeated keys do not duplicate running work", async () => {
  const queue = createImagePreloadQueue(1);
  const blocked = gate(), runningKey = {}, canceledKey = {}, updatedKey = {};
  const order: string[] = [];
  queue.enqueue(runningKey, async () => { order.push("running"); await blocked.promise; });
  queue.enqueue(runningKey, async () => { order.push("duplicate"); });
  queue.enqueue(canceledKey, async () => { order.push("canceled"); });
  queue.enqueue(updatedKey, async () => { order.push("old"); }, 100);
  queue.enqueue(updatedKey, async () => { order.push("replacement"); }, 1);
  queue.cancel(canceledKey);
  queue.cancel(runningKey);
  await flush(); assert.deepEqual(order, ["running"], "cancel does not interrupt an active browser load");
  blocked.resolve(); await flush(); assert.deepEqual(order, ["running", "replacement"]);
  queue.enqueue(runningKey, async () => { order.push("new-source"); }); await flush();
  assert.deepEqual(order, ["running", "replacement", "new-source"]);
});

test("both a synchronous throw and a rejected load release capacity", async () => {
  const queue = createImagePreloadQueue(1);
  const order: string[] = [];
  queue.enqueue({}, () => { order.push("throw"); throw new Error("expected-sync-failure"); });
  queue.enqueue({}, async () => { order.push("reject"); throw new Error("expected-async-failure"); });
  queue.enqueue({}, async () => { order.push("after-errors"); });
  await flush(); assert.deepEqual(order, ["throw", "reject", "after-errors"]);
});
