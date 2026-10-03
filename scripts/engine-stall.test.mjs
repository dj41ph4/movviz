import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";

function fixture(t) {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const backend = Object.create(AbstractBackend.prototype);
  const meta = { lastActivityAt: null, lastActivitySampleAt: null, lastDownloaded: 0, queued: false, stalled: false };
  const torrent = { infoHash: "test", downloaded: 0, downloadSpeed: 0, numPeers: 5 };
  backend.meta = new Map([[torrent.infoHash, meta]]);
  backend.cfg = { maxActive: 0 };
  backend._isDone = () => false;
  let changes = 0;
  let reconciliations = 0;
  backend.onChange = () => changes++;
  backend.reconcileQueue = () => reconciliations++;
  return { backend, meta, torrent, advance: (ms) => { now += ms; }, changes: () => changes, reconciliations: () => reconciliations };
}

test("connected peers without progress cannot prevent blocking after two minutes", (t) => {
  const f = fixture(t);
  f.backend._checkStall(f.torrent);
  f.advance(119_999);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, false);
  f.advance(1);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, true);
  assert.equal(f.meta.queued, true);
  assert.equal(f.reconciliations(), 1, "free the slot for other downloads");
  assert.equal(f.changes(), 1);
});

test("continuous 19 bytes/s traffic does not reset the inactivity timer", (t) => {
  const f = fixture(t);
  f.torrent.downloadSpeed = 19;
  f.backend._checkStall(f.torrent);
  for (let i = 0; i < 24; i++) {
    f.advance(5000);
    f.torrent.downloaded += 95;
    f.backend._checkStall(f.torrent);
  }
  assert.equal(f.meta.stalled, true);
});

test("20 bytes/s resets the timer, and a later two-minute stall still blocks", (t) => {
  const f = fixture(t);
  f.backend._checkStall(f.torrent);
  f.advance(115_000);
  f.torrent.downloadSpeed = 20;
  f.backend._checkStall(f.torrent);
  const activeAt = f.meta.lastActivityAt;
  f.torrent.downloadSpeed = 0;
  f.advance(119_999);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, false);
  assert.equal(f.meta.lastActivityAt, activeAt);
  f.advance(1);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, true);
});

test("measured byte growth at 20 bytes/s counts even if backend speed is unavailable", (t) => {
  const f = fixture(t);
  f.backend._checkStall(f.torrent);
  for (let i = 0; i < 30; i++) {
    f.advance(5000);
    f.torrent.downloaded += 100;
    f.backend._checkStall(f.torrent);
  }
  assert.equal(f.meta.stalled, false);
});

test("an existing downloaded total on first observation is not current activity", (t) => {
  const f = fixture(t);
  f.torrent.downloaded = 50_000_000;
  f.backend._checkStall(f.torrent);
  f.advance(120_000);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, true);
});

for (const flag of ["userPaused", "queued", "verifying", "finishing", "completed"]) {
  test(`${flag} time is excluded and does not cause immediate blocking on return`, (t) => {
    const f = fixture(t);
    f.backend._checkStall(f.torrent);
    f.meta[flag] = true;
    f.advance(600_000);
    f.backend._checkStall(f.torrent);
    assert.equal(f.meta.stalled, false);
    f.meta[flag] = false;
    f.advance(5000);
    f.backend._checkStall(f.torrent);
    assert.equal(f.meta.stalled, false);
  });
}

test("torrent hash verification is exempt", (t) => {
  const f = fixture(t);
  f.torrent.verifying = true;
  f.advance(600_000);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, false);
});

test("blocked torrent only recovers with meaningful traffic, not peers or trickle bytes", (t) => {
  const f = fixture(t);
  f.backend._checkStall(f.torrent);
  f.advance(120_000);
  f.backend._checkStall(f.torrent);
  f.torrent.downloadSpeed = 19;
  f.torrent.downloaded += 95;
  f.advance(5000);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, true);
  f.torrent.downloadSpeed = 20;
  f.advance(5000);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, false);
  assert.equal(f.meta.queued, true);
  assert.ok(f.meta.dequeuedAt, "recover at the end of the queue");
});

test("manual resume grants a fresh two-minute activity window", async (t) => {
  const f = fixture(t);
  f.meta.userPaused = true;
  f.meta.lastActivityAt = Date.now() - 600_000;
  f.backend._clientResume = async () => true;
  assert.equal(await f.backend.resume("test"), true);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, false);
  f.advance(120_000);
  f.backend._checkStall(f.torrent);
  assert.equal(f.meta.stalled, true);
});
