import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-json-inplace-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
process.env.MOVVIZ_DATA_DIR = dir;
const { readJsonCached, writeJsonCached, flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The library stores mutate the cached array IN PLACE and hand the same
// reference back to writeJsonCached (updateSeries: list[i] = updated). A
// finished write of an OLDER state used to mark the cache "same as disk"
// because the reference was the same — while a newer change was still
// waiting. The next read then saw the file change under it and re-read +
// re-parsed the whole store from disk (25 MB of library-series.json on the
// main thread, 0.6–1.3 s frozen each time), and could hand out a stale copy.
test("in-place changes written in a burst: the cached value is never re-read from disk, never stale", async () => {
  const file = path.join(dir, "store.json");
  const list: number[] = [0];
  writeJsonCached(file, list);
  await sleep(500);

  // Slow down the "write finished" confirmation so the window is wide.
  const realStat = fs.promises.stat;
  fs.promises.stat = (async (...a: Parameters<typeof realStat>) => { await sleep(150); return realStat(...a); }) as typeof realStat;
  const realRead = fs.readFileSync;
  let reparses = 0;
  fs.readFileSync = ((...a: Parameters<typeof realRead>) => { if (a[0] === file) reparses++; return realRead(...a); }) as typeof realRead;
  try {
    let n = 0;
    for (let round = 0; round < 4; round++) {
      // A first change: its write starts after the coalescing delay…
      list.push(++n);
      writeJsonCached(file, list);
      await sleep(330);
      // …and while it is in flight, a second in-place change is scheduled.
      list.push(++n);
      writeJsonCached(file, list);
      // The first write confirms, then the second lands on disk: reads in
      // that stretch must keep the live array.
      for (const wait of [380, 60, 60, 300]) {
        await sleep(wait);
        const seen = readJsonCached<number[]>(file, []);
        assert.equal(seen, list, "a read must return the live array, not a copy re-read from disk");
        assert.equal(seen[seen.length - 1], n, "a read must see the latest change");
      }
      await sleep(1100);
    }
    assert.equal(reparses, 0, "the store's own writes must never trigger a re-read of the file");
  } finally {
    fs.promises.stat = realStat;
    fs.readFileSync = realRead;
  }
  await sleep(1200);
  flushPendingJsonWritesSync();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), list);
});
