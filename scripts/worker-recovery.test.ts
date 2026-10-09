import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WorkerPool } from "@/lib/workers/workerPool";

test("un worker bloqué est remplacé et une tâche expirée en file ne s'exécute jamais", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-worker-recovery-"));
  const script = path.join(dir, "worker.mjs");
  fs.writeFileSync(script, `import { parentPort } from 'node:worker_threads';
parentPort.on('message', (input) => {
  if (input === 'hang') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  parentPort.postMessage({ok:true,value:input});
});`);
  const pool = new WorkerPool<string, string>(pathToFileURL(script), 1);
  try {
    const hung = assert.rejects(pool.run("hang", 600), /worker task timed out/);
    await assert.rejects(pool.run("expired", 50), /worker queue timed out/);
    await hung;
    assert.equal(await pool.run("recovered", 2000), "recovered");
  } finally { pool.close(); }
  await assert.rejects(pool.run("closed"), /worker pool closed/);
});

test("une erreur de transfert ne laisse pas un worker occupé", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-worker-clone-"));
  const script = path.join(dir, "worker.mjs");
  fs.writeFileSync(script, `import { parentPort } from 'node:worker_threads'; parentPort.on('message', value => parentPort.postMessage({ok:true,value}));`);
  const pool = new WorkerPool<unknown, unknown>(pathToFileURL(script), 1);
  try {
    await assert.rejects(pool.run(() => {}, 200));
    assert.equal(await pool.run("ok", 2000), "ok");
  } finally { pool.close(); }
});
