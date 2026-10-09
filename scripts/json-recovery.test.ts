import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeJsonCached, jsonPersistenceHealthy, flushPendingJsonWritesSync } from "@/lib/fsJsonCache";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("échec de persistance retenu, seuil élevé, puis rétablissement avec la dernière valeur", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-json-recovery-"));
  const dir = path.join(root, "temporarily-unavailable");
  const file = path.join(dir, "store.json");
  writeJsonCached(file, { version: 1 });
  await wait(500);
  assert.equal(jsonPersistenceHealthy(), true);
  assert.equal(jsonPersistenceHealthy(Date.now() + 301000), false);
  fs.mkdirSync(dir);
  writeJsonCached(file, { version: 2 });
  const until = Date.now() + 35000;
  while (!fs.existsSync(file) && Date.now() < until) await wait(100);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { version: 2 });
  assert.equal(jsonPersistenceHealthy(Date.now() + 301000), true);
  assert.equal(flushPendingJsonWritesSync(), 0);
});
