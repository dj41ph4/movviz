import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-engine-reset-"));
process.env.MOVVIZ_CONFIG_DIR = root;
process.env.MOVVIZ_DATA_DIR = root;
const { MovvizEngine } = await import("../engine/src/engine.mjs");
const { STATE_FILE } = await import("../engine/src/config.mjs");
const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
const { createApiServer } = await import("../engine/src/api.mjs");
const { ENGINE_TOKEN } = await import("../engine/src/config.mjs");

function fixture() {
  const engine = new MovvizEngine();
  engine.started = true;
  const removals = [];
  for (const id of ["movies", "series"]) {
    const queue = [{ infoHash: id }];
    engine.instances.set(id, {
      meta: new Map([[id, {}]]),
      list: () => [...queue],
      remove: async (hash, deleteData) => { removals.push({ hash, deleteData }); queue.length = 0; return true; },
    });
  }
  engine._recreateInstances = async () => {};
  return { engine, removals };
}

test("reset clears engine queue and settings while preserving media", async () => {
  const { engine, removals } = fixture();
  const media = path.join(root, "episode.mkv");
  fs.writeFileSync(media, "video");
  await engine.factoryReset();
  assert.deepEqual(removals.map((r) => r.deleteData), [false, false]);
  assert.equal(fs.readFileSync(media, "utf8"), "video");
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  assert.deepEqual(state.torrents, []);
  assert.equal(state.instances.movies.maxActive, 2);
  assert.equal(state.instances.series.maxActive, 4);
});

test("reset refuses an in-progress import before removing anything", async () => {
  const { engine, removals } = fixture();
  engine.instances.get("series").meta.get("series").processing = true;
  await assert.rejects(engine.factoryReset(), /engine_busy/);
  assert.deepEqual(removals, []);
});

test("the actual torrent removal path preserves downloaded files when deleteData is false", async () => {
  const downloadDir = path.join(root, "downloads");
  fs.mkdirSync(downloadDir);
  const file = path.join(downloadDir, "episode.mkv");
  fs.writeFileSync(file, "downloaded video");
  let deleteStore = null;
  const backend = {
    cfg: { downloadPath: downloadDir },
    meta: new Map([["abcdef", { completed: false }]]),
    importedHistory: new Map(),
    manualSeed: { report: () => null },
    _clientSnapshot: () => ({ name: "episode.mkv", files: [{ path: file }] }),
    _clientRemove: async (_hash, deleteData) => { deleteStore = deleteData; return true; },
    _dropCachedTorrentFile: async () => {},
    reconcileQueue: () => {},
    onChange: () => {},
  };
  assert.equal(await AbstractBackend.prototype.remove.call(backend, "abcdef", false), true);
  assert.equal(deleteStore, false);
  assert.equal(fs.readFileSync(file, "utf8"), "downloaded video");
});

test("engine refuses concurrent mutations while reset is running", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const engine = { _factoryResetInProgress: false, clientRestart: {}, async factoryReset() {
    this._factoryResetInProgress = true;
    await pending;
    this._factoryResetInProgress = false;
  } };
  const { server } = createApiServer(engine);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { "x-movviz-token": ENGINE_TOKEN };
  try {
    const reset = fetch(`${url}/factory-reset`, { method: "POST", headers });
    while (!engine._factoryResetInProgress) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await fetch(`${url}/instances/movies`, { method: "PATCH", headers })).status, 503);
    finish();
    assert.equal((await reset).status, 200);
  } finally {
    finish();
    await new Promise((resolve) => server.close(resolve));
  }
});
