import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";

test("replacement notification retries wait ten minutes and survive engine restoration", async t => {
  let now = 1_000_000, calls = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "replacement_refused", replacementFailure: { reason: "fileInUse", attempts: calls, retryAt: now + 600_000, discarded: false } }, { status: 409 });
  });
  const backend = Object.create(AbstractBackend.prototype);
  backend.cfg = { id: "test", category: "movie" };
  const meta = { libraryRef: "movie:mv_test", movedTo: "/library/Film (2).mkv", movedFiles: [{ path: "/library/Film (2).mkv", size: 100 }], notifiedLibrary: false };
  backend.meta = new Map([["hash", meta]]);
  backend.importedHistory = new Map([["hash", { infoHash: "hash", libraryRef: meta.libraryRef, movedTo: meta.movedTo }]]);
  backend.onChange = () => {};
  backend._clientList = () => [];
  await backend._notifyLibrary(meta.libraryRef, meta.movedFiles, "hash");
  assert.equal(calls, 1);
  now += 599_999;
  backend.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  const saved = backend.persistable()[0];
  backend.meta.clear();
  backend.importedHistory.clear();
  backend.restoreImported(saved);
  assert.equal(backend.meta.get("hash").replacementFailure.attempts, 1);
  assert.equal(backend.list()[0].state, "blocked");
  now++;
  backend.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(backend.meta.get("hash").replacementFailure.attempts, 2);
});
