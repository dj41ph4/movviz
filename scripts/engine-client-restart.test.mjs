import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

// Never touch an installed user's download state or open torrent ports.
const root = await mkdtemp(path.join(tmpdir(), "movviz-restart-test-"));
process.env.MOVVIZ_CONFIG_DIR = root;
process.env.MOVVIZ_DATA_DIR = root;
const { MovvizEngine } = await import("../engine/src/engine.mjs");
const { STATE_FILE, ENGINE_TOKEN } = await import("../engine/src/config.mjs");
const { stopClientProcess } = await import("../engine/src/processLifecycle.mjs");
const { createApiServer } = await import("../engine/src/api.mjs");

function fixture(factory) {
  const engine = new MovvizEngine();
  engine.state = {};
  engine._clientType = "webtorrent";
  const records = [
    { infoHash: "abc", magnetURI: "magnet:?xt=urn:btih:abc", userPaused: true, addedAt: 123, episodeTargets: [{ season: 1, episode: 3 }] },
    { infoHash: "def", movedTo: "/library/movie.mkv", userPaused: false },
  ];
  const events = [];
  const cfg = { id: "films", name: "Films" };
  engine.configs = () => [engine.state.instances?.films ?? cfg];
  engine.instances.set("films", {
    cfg,
    persistable: () => records,
    destroy: async () => { events.push("destroy"); engine.persist(); },
  });
  const make = factory ?? ((config, deps) => {
    const restored = [];
    return {
      cfg: config, client: {}, _available: true,
      init: async () => { events.push("init"); deps.onChange(); },
      add: async (_id, opts) => { events.push("add"); restored.push({ ...opts, userPaused: opts.paused }); deps.onChange(); },
      restoreImported: (rec) => { restored.push(rec); },
      persistable: () => restored,
      destroy: async () => { events.push("destroy-new"); },
    };
  });
  engine._recreateInstances = () => MovvizEngine.prototype._recreateInstances.call(engine, make, true);
  return { engine, events, records };
}

test("actual destroy/init restores queue, pauses and imported history; callbacks cannot erase snapshot", async () => {
  const { engine, events } = fixture();
  engine._torrentsCache = [{ stale: true }];
  engine.restartClients();
  assert.equal(engine.clientRestart.restarting, true);
  const task = engine._restartTask;
  engine.restartClients();
  assert.equal(engine._restartTask, task);
  await task;
  assert.deepEqual(events, ["destroy", "init", "add"]);
  assert.deepEqual(engine.clientRestart, { restarting: false, error: null });
  assert.equal(engine.state.torrents.length, 2);
  assert.equal(engine.state.torrents[0].userPaused, true);
  assert.equal(engine.state.torrents[0].addedAt, 123);
  assert.deepEqual(engine.state.torrents[0].episodeTargets, [{ season: 1, episode: 3 }]);
  assert.equal(engine.state.torrents[1].movedTo, "/library/movie.mkv");
  assert.equal(engine._torrentsCache, null);
  const durable = JSON.parse(await readFile(STATE_FILE, "utf8"));
  assert.equal(durable.torrents.length, 2);
});

test("offline client reports failure, retains durable queue and permits retry", async () => {
  const { engine } = fixture((cfg) => ({ cfg, client: null, init: async () => {}, destroy: async () => {} }));
  engine.restartClients();
  await engine._restartTask;
  assert.equal(engine.clientRestart.restarting, false);
  assert.match(engine.clientRestart.error, /offline/);
  engine.persist();
  assert.equal(engine.state.torrents.length, 2);
  const snapshot = JSON.stringify(engine.state);
  engine._recreateInstances = async () => {
    assert.equal(JSON.stringify(engine.state), snapshot);
    throw new Error("retry still offline");
  };
  engine.restartClients();
  await engine._restartTask;
  assert.match(engine.clientRestart.error, /retry still offline/);
  assert.equal(engine.state.torrents.length, 2);
});

test("native and libtorrent ready instances restore successfully", async () => {
  for (const clientType of ["native", "libtorrent"]) {
    const { engine } = fixture();
    engine._clientType = clientType;
    engine.restartClients();
    await engine._restartTask;
    assert.equal(engine.clientRestart.error, null);
    assert.equal(engine.state.torrents.length, 2);
  }
});

test("missing restoration input is an error, not a successful empty queue", async () => {
  const { engine, records } = fixture();
  delete records[0].magnetURI;
  engine.restartClients();
  await engine._restartTask;
  assert.match(engine.clientRestart.error, /Cannot restore torrent/);
  assert.equal(engine.state.torrents.length, 2);
});

test("graceful process shutdown waits for actual exit", async () => {
  const child = new EventEmitter();
  Object.assign(child, { exitCode: null, signalCode: null, kill: () => assert.fail("unexpected kill") });
  let stopped = false;
  const stopping = stopClientProcess(child, () => setTimeout(() => child.emit("exit"), 10), 100).then(() => { stopped = true; });
  assert.equal(stopped, false);
  await stopping;
  assert.equal(stopped, true);
  assert.equal(child.listenerCount("exit"), 0);
});

test("unresponsive process is killed and exit confirmed", async () => {
  const child = new EventEmitter();
  let kills = 0;
  Object.assign(child, { exitCode: null, signalCode: null, kill: () => { kills++; setTimeout(() => child.emit("exit"), 5); } });
  await stopClientProcess(child, () => new Promise(() => {}), 5);
  assert.equal(kills, 1);
});

test("API acknowledges asynchronously, exposes progress and blocks concurrent writes", async () => {
  const engine = {
    clientRestart: { restarting: false, error: null },
    restartClients() { this.clientRestart.restarting = true; this._preserveRestartState = true; },
  };
  const { server } = createApiServer(engine);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { "x-movviz-token": ENGINE_TOKEN };
  try {
    const res = await fetch(`${url}/client-restart`, { method: "POST", headers });
    assert.equal(res.status, 202);
    assert.equal((await res.json()).restarting, true);
    assert.equal((await (await fetch(`${url}/client-restart`, { headers })).json()).restarting, true);
    assert.equal((await fetch(`${url}/torrents/pause-all`, { method: "POST", headers })).status, 503);
    assert.equal((await fetch(`${url}/client-restart`, { method: "POST", headers })).status, 202);
    if (ENGINE_TOKEN) assert.equal((await fetch(`${url}/client-restart`, { method: "POST" })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
