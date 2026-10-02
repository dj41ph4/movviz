import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { WebTorrentBackend } from "../engine/src/backends/WebTorrentBackend.mjs";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";
import { createApiServer } from "../engine/src/api.mjs";
import { ENGINE_TOKEN } from "../engine/src/config.mjs";

test("WebTorrent pause closes existing and reconnecting wires without removing files; resume permits traffic", async () => {
  const backend = new WebTorrentBackend({ id: "test", downloadPath: "/unused" });
  const torrent = Object.assign(new EventEmitter(), {
    infoHash: "abc", paused: false, wires: [],
    pause() { this.paused = true; }, resume() { this.paused = false; },
  });
  let closed = 0;
  torrent.wires.push({ destroy() { closed++; } });
  backend.client = { torrents: [torrent] }; // no remove/destroy: data must stay intact
  backend.meta.set("abc", { userPaused: false });
  assert.equal(await backend.pause("ABC"), true);
  assert.equal(closed, 1);
  torrent.emit("wire", { destroy() { closed++; } });
  assert.equal(closed, 2);
  await backend.pause("abc");
  assert.equal(torrent.listenerCount("wire"), 1, "idempotent guard");
  assert.equal(await backend.resume("abc"), true);
  const before = closed;
  torrent.emit("wire", { destroy() { closed++; } });
  assert.equal(closed, before);
  assert.equal(backend.meta.get("abc").userPaused, false);
});

test("pause awaits native transport, rolls back failed pause and persists successful state", async () => {
  let finish;
  let persisted = 0;
  const backend = new AbstractBackend({ id: "test" }, { onChange: () => persisted++ });
  backend.meta.set("abc", { userPaused: false });
  backend._clientPause = () => new Promise((resolve) => { finish = resolve; });
  let returned = false;
  const pending = backend.pause("abc").then((ok) => { returned = true; return ok; });
  await Promise.resolve();
  assert.equal(returned, false);
  finish(false);
  assert.equal(await pending, false);
  assert.equal(backend.meta.get("abc").userPaused, false);
  backend._clientPause = async () => true;
  assert.equal(await backend.pause("abc"), true);
  assert.equal(backend.meta.get("abc").userPaused, true);
  backend._clientResume = async () => false;
  assert.equal(await backend.resume("abc"), false);
  assert.equal(backend.meta.get("abc").userPaused, true);
  assert.ok(persisted > 0);
});

test("HTTP API awaits pause/resume and rejects transport failures instead of serializing a Promise", async () => {
  const { server } = createApiServer({ pause: async () => false, resume: async () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/torrents/abc`;
    const headers = ENGINE_TOKEN ? { "x-movviz-token": ENGINE_TOKEN } : {};
    const paused = await fetch(`${url}/pause`, { method: "POST", headers });
    assert.equal(paused.status, 409);
    assert.deepEqual(await paused.json(), { ok: false });
    const resumed = await fetch(`${url}/resume`, { method: "POST", headers });
    assert.equal(resumed.status, 200);
    assert.deepEqual(await resumed.json(), { ok: true });
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
