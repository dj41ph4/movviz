import test from "node:test";
import assert from "node:assert/strict";

const { takeMemoryCensus, getMemoryCensus } = await import("../src/lib/memoryCensus.ts");

test("counts the long-lived structures anchored on globalThis, big ones only", () => {
  const g = globalThis as Record<string, unknown>;
  g.__movvizTestBigMap = new Map(Array.from({ length: 500 }, (_, i) => [i, i]));
  g.__movvizTestSmallSet = new Set([1, 2, 3]);
  g.__movvizTestState = { rows: Array.from({ length: 300 }, (_, i) => i), label: "x" };
  g.notMovviz = new Map(Array.from({ length: 900 }, (_, i) => [i, i]));
  const sample = takeMemoryCensus();
  assert.equal(sample.sizes.__movvizTestBigMap, 500);
  assert.equal(sample.sizes["__movvizTestState.rows"], 300);
  assert.equal("__movvizTestSmallSet" in sample.sizes, false);
  assert.equal("notMovviz" in sample.sizes, false);
  assert.ok(sample.heapUsedMb > 0);
  const census = getMemoryCensus();
  assert.ok(census.heapLimitMb > 0);
  assert.ok(Array.isArray(census.history));
});
