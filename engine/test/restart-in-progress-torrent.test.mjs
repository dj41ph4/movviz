import test from "node:test";
import assert from "node:assert/strict";
import { MovvizEngine } from "../src/engine.mjs";

const HASH = "2babeba428ac629f307ba343bf0c00c679daeaf7";

/** Mimics the real backend: remove() wipes the in-memory record, and an
 *  in-progress torrent never has an importedHistory entry. */
function fakeInstance(meta, { removeOk = true } = {}) {
  const calls = { removed: [], added: [] };
  const metaMap = new Map(meta ? [[HASH, meta]] : []);
  const inst = {
    meta: metaMap,
    importedHistory: new Map(),
    _get: (h) => (metaMap.has(h) ? { infoHash: h } : null),
    remove: async (h) => { calls.removed.push(h); if (!removeOk) return false; metaMap.delete(h); return true; },
    add: async (id, opts) => { calls.added.push({ id, opts }); },
  };
  return { inst, calls };
}

function engineWith(inst) {
  const engine = Object.create(MovvizEngine.prototype);
  engine.findByInfoHash = () => inst;
  return engine;
}

test("restarting an in-progress torrent puts it back instead of just removing it", async () => {
  const { inst, calls } = fakeInstance({
    magnetURI: `magnet:?xt=urn:btih:${HASH}`, addedAt: 123, sequential: true, priority: "high",
    libraryRef: "series:abc", title: "Star Academy", year: 2024, episodeTarget: { season: 11, episode: 4 },
  });
  assert.equal(await engineWith(inst).restart(HASH), true);
  assert.equal(calls.removed.length, 1);
  assert.equal(calls.added.length, 1);
  assert.equal(calls.added[0].id, `magnet:?xt=urn:btih:${HASH}`);
  assert.equal(calls.added[0].opts.libraryRef, "series:abc");
  assert.equal(calls.added[0].opts.priority, "high");
  assert.deepEqual(calls.added[0].opts.episodeTarget, { season: 11, episode: 4 });
});

test("a torrent with no way to be restored is left untouched, not removed", async () => {
  const { inst, calls } = fakeInstance({ magnetURI: null, libraryRef: "series:abc" });
  assert.equal(await engineWith(inst).restart(HASH), false);
  assert.equal(calls.removed.length, 0);
  assert.equal(calls.added.length, 0);
});

test("when the removal is refused nothing is re-added", async () => {
  const { inst, calls } = fakeInstance({ magnetURI: `magnet:?xt=urn:btih:${HASH}` }, { removeOk: false });
  assert.equal(await engineWith(inst).restart(HASH), false);
  assert.equal(calls.added.length, 0);
});
