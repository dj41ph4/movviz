import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../src/backends/AbstractBackend.mjs";

test("clearing a download retains moved files until their library import succeeds", async () => {
  const infoHash = "abcdef";
  const pending = { libraryRef: "episode:series:1:2", movedFiles: [{ path: "/library/episode.mkv" }], notifiedLibrary: false };
  let removedFromClient = false;
  const backend = {
    meta: new Map([[infoHash, pending]]),
    importedHistory: new Map(),
    _notifyLibrary: async () => false,
    _clientRemove: async () => { removedFromClient = true; return true; },
  };
  assert.equal(await AbstractBackend.prototype.remove.call(backend, infoHash, false), false);
  assert.equal(backend.meta.get(infoHash), pending);
  assert.equal(removedFromClient, false);
});
