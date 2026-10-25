import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AbstractBackend, importedFilesStillPresent } from "../src/backends/AbstractBackend.mjs";

function fakeBackend(hist) {
  const added = [];
  const backend = {
    cfg: { id: "movies", logTag: "test" },
    folderError: null,
    importedHistory: new Map([[hist.infoHash, hist]]),
    _get: () => null,
    importedSummary: (h) => ({ infoHash: h.infoHash, state: "completed" }),
    onChange: () => {},
    _clientAdd: async (id) => { added.push(id); throw new Error("stop-after-client-add"); },
  };
  return { backend, added };
}

test("re-grabbing a release whose imported file was deleted downloads it again", async () => {
  const hist = { infoHash: "2babeba428ac629f307ba343bf0c00c679daeaf7", movedTo: path.join(os.tmpdir(), "movviz-missing", "Buddy.mkv"), size: 10 };
  const { backend, added } = fakeBackend(hist);
  await assert.rejects(
    AbstractBackend.prototype.add.call(backend, "magnet:?xt=urn:btih:2babeba428ac629f307ba343bf0c00c679daeaf7", {}),
    /stop-after-client-add/,
  );
  assert.equal(added.length, 1);
  assert.equal(backend.importedHistory.has("2babeba428ac629f307ba343bf0c00c679daeaf7"), false);
});

test("re-grabbing a release whose imported file is still present stays deduplicated", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-present-"));
  const file = path.join(dir, "Buddy.mkv");
  fs.writeFileSync(file, "0123456789");
  const hist = { infoHash: "2babeba428ac629f307ba343bf0c00c679daeaf7", movedTo: file, size: 10 };
  const { backend, added } = fakeBackend(hist);
  const summary = await AbstractBackend.prototype.add.call(backend, "magnet:?xt=urn:btih:2babeba428ac629f307ba343bf0c00c679daeaf7", {});
  assert.equal(summary.state, "completed");
  assert.equal(added.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a file replaced by another version at the same path counts as absent", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-replaced-"));
  const file = path.join(dir, "Buddy.mkv");
  fs.writeFileSync(file, "a much larger replacement file");
  assert.equal(await importedFilesStillPresent({ movedTo: file, size: 10 }), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
