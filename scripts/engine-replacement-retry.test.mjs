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

test("un utilisateur peut supprimer un import dont le remplacement est refusé, sans attendre le budget de reprises", async t => {
  let notified = 0;
  t.mock.method(globalThis, "fetch", async () => { notified++; return Response.json({ error: "replacement_refused" }, { status: 409 }); });
  const backend = Object.create(AbstractBackend.prototype);
  backend.cfg = { id: "test", category: "series", downloadPath: "/tmp/movviz-dl-unused" };
  const failure = { reason: "nameOccupied", attempts: 1, retryAt: Date.now() + 600_000, discarded: false };
  const record = { infoHash: "hash", libraryRef: "series:sr_test", movedFiles: [{ path: "/library/S01E01.mkv", originalPath: "/dl/S01E01.mkv" }], notifiedLibrary: false, replacementFailure: failure };
  backend.meta = new Map();
  backend.importedHistory = new Map([["hash", record]]);
  backend.onChange = () => {};
  backend._clientRemove = async () => true;
  backend._clientGet = () => null;
  const cleaned = [];
  backend._cleanupReplacementSource = async (snap, files) => { cleaned.push(files); };
  backend._dropCachedTorrentFile = async () => {};
  backend._clientSnapshot = () => ({ infoHash: "hash", name: "x", files: [] });
  assert.equal(await backend.remove("hash", false), true);
  assert.equal(notified, 0, "ne retente pas une notification déjà refusée");
  assert.equal(cleaned.length, 1, "nettoie uniquement les fichiers sources du téléchargement");
  assert.equal(backend.importedHistory.has("hash"), false);
});

test("sans refus de remplacement, la suppression attend toujours la confirmation de la bibliothèque", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("fetch failed"); });
  t.mock.method(console, "error", () => {});
  const backend = Object.create(AbstractBackend.prototype);
  backend.cfg = { id: "test", category: "series", downloadPath: "/tmp/movviz-dl-unused" };
  const record = { infoHash: "hash", libraryRef: "series:sr_test", movedFiles: [{ path: "/library/S01E01.mkv" }], notifiedLibrary: false };
  backend.meta = new Map();
  backend.importedHistory = new Map([["hash", record]]);
  backend.onChange = () => {};
  assert.equal(await backend.remove("hash", false), false);
  assert.equal(backend.importedHistory.has("hash"), true);
});
