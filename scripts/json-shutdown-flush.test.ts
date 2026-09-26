import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeJsonCached, flushPendingJsonWritesSync, readJsonCached } from "@/lib/fsJsonCache";

test("à l'arrêt, un changement encore en attente d'écriture est enregistré, rien n'est perdu", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-flush-"));
  const file = path.join(dir, "store.json");
  writeJsonCached(file, { v: 1 });
  writeJsonCached(file, { v: 2 }); // still in its coalescing window
  assert.equal(fs.existsSync(file), false, "nothing written yet");
  assert.ok(flushPendingJsonWritesSync() >= 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { v: 2 });
  assert.deepEqual(readJsonCached(file, null), { v: 2 });
  assert.equal(flushPendingJsonWritesSync(), 0, "nothing left pending");
});
