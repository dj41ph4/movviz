import test, { after } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";

// Generated payloads only: never open a user's media or contact public trackers.
const root = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-seed-test-"));
after(async () => {
  const target = path.resolve(root), temp = path.resolve(os.tmpdir());
  if (!target.startsWith(temp + path.sep) || !path.basename(target).startsWith("movviz-seed-test-") || path.dirname(target) !== temp || target.split(path.sep).filter(Boolean).length < 2) throw new Error("unsafe seed test cleanup");
  await fsp.rm(target, { recursive: true, force: true });
});
process.env.MOVVIZ_CONFIG_DIR = path.join(root, "config");
process.env.MOVVIZ_DATA_DIR = root;
const { ManualSeed, ReadOnlySeedStore, cacheMetainfo, torrentPath } = await import("../engine/src/manualSeed.mjs");
const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
const { WebTorrentBackend } = await import("../engine/src/backends/WebTorrentBackend.mjs");
const { NativeTorrentBackend } = await import("../engine/src/backends/NativeTorrentBackend.mjs");
const { LibtorrentBackend } = await import("../engine/src/backends/LibtorrentBackend.mjs");
const { default: WebTorrent } = await import("../engine/node_modules/webtorrent/index.js");
const { default: createTorrent } = await import("../engine/node_modules/create-torrent/index.js");
const { default: parseTorrent } = await import("../engine/node_modules/parse-torrent/index.js");

async function until(check, message) {
  const end = Date.now() + 15_000;
  while (!check()) {
    if (Date.now() > end) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function fixture(t, names = ["Inception.2010.1080p-GROUP.mkv"], sizes = []) {
  const dir = await fsp.mkdtemp(path.join(root, "case-"));
  const cfg = { id: "films", category: "movie", downloadPath: path.join(dir, "downloads"), completedPath: path.join(dir, "library"), maxActive: 2, autoMoveOnComplete: true, seedRatio: 0 };
  await Promise.all([fsp.mkdir(cfg.downloadPath), fsp.mkdir(cfg.completedPath)]);
  const buffers = names.map((name, i) => Object.assign(randomBytes(sizes[i] ?? 65536), { name }));
  const metainfo = await new Promise((resolve, reject) => createTorrent(buffers, { name: names.length === 1 ? names[0] : "Breaking.Bad.S01", pieceLength: 16384, announceList: [], private: true }, (err, bytes) => err ? reject(err) : resolve(bytes)));
  const parsed = await parseTorrent(metainfo);
  const movedFiles = [];
  for (let i = 0; i < parsed.files.length; i++) {
    const target = path.join(cfg.completedPath, `Renamed ${i}.mkv`);
    const buffer = buffers.find((b) => parsed.files[i].path.endsWith(b.name));
    await fsp.writeFile(target, buffer);
    movedFiles.push({ originalPath: parsed.files[i].path, path: target, size: buffer.length });
  }
  await cacheMetainfo(parsed.infoHash, metainfo);
  const client = new WebTorrent({ torrentPort: 0, dht: false, tracker: false, lsd: false, utp: false, natUpnp: false, natPmp: false });
  client.on("error", () => {});
  await new Promise((resolve) => client.listening ? resolve() : client.once("listening", resolve));
  const seed = new ManualSeed(cfg, async () => client, () => {});
  t.after(async () => { await seed.destroy(); if (!client.destroyed) await new Promise((resolve) => client.destroy(resolve)); });
  const rec = { infoHash: parsed.infoHash, name: parsed.name, size: parsed.length, movedTo: movedFiles[0].path, movedFiles, completedAt: Date.now(), magnetURI: null, libraryRef: "movie:mv_inception", title: "Inception", year: 2010 };
  return { cfg, metainfo, parsed, buffers, rec, client, seed };
}

test("renamed movie hashes completely, uploads to a real peer, stops without touching library bytes", async (t) => {
  const f = await fixture(t);
  assert.equal(f.seed.start(f.rec), true);
  assert.equal(f.seed.report(f.rec.infoHash).state, "verifying");
  await until(() => f.seed.report(f.rec.infoHash).state === "full", "renamed movie must verify");
  let requests = 0;
  f.seed.sessions.get(f.rec.infoHash).torrent.on("wire", (wire) => {
    const request = wire.request;
    wire.request = function (...args) { requests++; return request.apply(this, args); };
  });
  const leecher = new WebTorrent({ torrentPort: 0, dht: false, tracker: false, lsd: false, utp: false, natUpnp: false, natPmp: false });
  t.after(async () => { if (!leecher.destroyed) await new Promise((resolve) => leecher.destroy(resolve)); });
  const dest = await fsp.mkdtemp(path.join(root, "peer-"));
  const torrent = leecher.add(f.metainfo, { path: dest });
  torrent.on("error", () => {});
  await new Promise((resolve) => torrent.infoHash ? resolve() : torrent.once("infoHash", resolve));
  torrent.addPeer(`127.0.0.1:${f.client.torrentPort}`);
  await until(() => torrent.done, "real peer must download the movie from the manual seed");
  assert.deepEqual(await fsp.readFile(path.join(dest, f.parsed.files[0].path)), Buffer.from(f.buffers[0]));
  assert.equal(requests, 0, "manual seed never requests data pieces (protocol handshakes are allowed)");
  assert.equal(await f.seed.stop(f.rec.infoHash), true);
  assert.equal(f.client.torrents.length, 0);
  assert.deepEqual(await fsp.readFile(f.rec.movedTo), Buffer.from(f.buffers[0]));
  assert.deepEqual(await fsp.readdir(f.cfg.downloadPath), [], "no symlinks or duplicate media");
});

test("pack with a deleted episode shares only verified pieces and never requests missing data", async (t) => {
  const f = await fixture(t, ["S01E01.mkv", "S01E02.mkv"], [40000, 40000]);
  await fsp.unlink(f.rec.movedFiles[1].path);
  f.seed.start(f.rec);
  await until(() => f.seed.report(f.rec.infoHash).state !== "verifying", "pack verification must finish");
  const report = f.seed.report(f.rec.infoHash);
  assert.equal(report.state, "partial");
  assert.equal(report.verifiedBytes, 32768, "piece overlapping the missing episode cannot be shared");
  const torrent = f.seed.sessions.get(f.rec.infoHash).torrent;
  assert.equal(torrent.received, 0);
  assert.equal(torrent._selections.length, 0, "missing pieces are never selected for download");
  // Even a reachable complete peer must not trigger repair of the missing episode.
  const donor = new WebTorrent({ torrentPort: 0, dht: false, tracker: false, lsd: false, utp: false, natUpnp: false, natPmp: false });
  t.after(async () => { if (!donor.destroyed) await new Promise((resolve) => donor.destroy(resolve)); });
  const donorPath = await fsp.mkdtemp(path.join(root, "complete-peer-"));
  for (let i = 0; i < f.parsed.files.length; i++) {
    const file = path.join(donorPath, f.parsed.files[i].path);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, f.buffers[i]);
  }
  const complete = donor.add(f.metainfo, { path: donorPath });
  complete.on("error", () => {});
  await until(() => complete.done, "complete peer must be ready");
  let requests = 0;
  torrent.on("wire", (wire) => {
    const request = wire.request;
    wire.request = function (...args) { requests++; return request.apply(this, args); };
  });
  torrent.addPeer(`127.0.0.1:${donor.torrentPort}`);
  await until(() => torrent.wires.length > 0, "partial seed must connect to the complete peer");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(requests, 0, "no data is requested even when all missing pieces are available");
  assert.equal(f.seed.report(f.rec.infoHash).state, "partial");
  assert.equal(await fsp.access(f.rec.movedFiles[1].path).then(() => true, () => false), false);
  assert.deepEqual(await fsp.readFile(f.rec.movedFiles[0].path), Buffer.from(f.buffers[0]));
});

test("missing or upgraded movie is refused after hashing; no file is recreated", async (t) => {
  for (const mode of ["missing", "different"]) {
    const f = await fixture(t);
    if (mode === "missing") await fsp.unlink(f.rec.movedTo);
    else await fsp.writeFile(f.rec.movedTo, Buffer.alloc(f.buffers[0].length));
    f.seed.start(f.rec);
    await until(() => f.seed.report(f.rec.infoHash).state === "unavailable", "changed movie must not seed");
    assert.equal(f.seed.report(f.rec.infoHash).reason, "files");
    assert.equal(f.client.torrents.length, 0);
    if (mode === "missing") assert.equal(await fsp.access(f.rec.movedTo).then(() => true, () => false), false);
    else assert.deepEqual(await fsp.readFile(f.rec.movedTo), Buffer.alloc(f.buffers[0].length));
  }
});

test("stop during asynchronous startup cannot resurrect a seed", async (t) => {
  const f = await fixture(t);
  let release;
  const seed = new ManualSeed(f.cfg, () => new Promise((resolve) => { release = resolve; }), () => {});
  seed.start(f.rec);
  await until(() => !!release, "startup must reach client acquisition");
  const pending = seed.sessions.get(f.rec.infoHash).pending;
  await seed.stop(f.rec.infoHash);
  release(f.client);
  await pending;
  assert.equal(seed.report(f.rec.infoHash), null);
  assert.equal(f.client.torrents.length, 0);
});

test("history preserves file mapping, avoids duplicate records and reseeds after restoration", async (t) => {
  const f = await fixture(t);
  const original = new WebTorrentBackend(f.cfg);
  original.client = { torrents: [] };
  original.importedHistory.set(f.rec.infoHash, f.rec);
  const saved = original.persistable();
  assert.deepEqual(saved[0].movedFiles, f.rec.movedFiles);
  const backend = new WebTorrentBackend(f.cfg);
  backend.client = f.client;
  backend.restoreImported(saved[0]);
  assert.equal(await backend.startSeeding(f.rec.infoHash.toUpperCase()), true);
  await until(() => backend.list()[0].seedStatus?.state === "full", "restored history must seed");
  assert.equal(backend.list()[0].state, "seeding");
  assert.equal(backend.list()[0].seeding, true);
  assert.equal(backend.list()[0].libraryRef, "movie:mv_inception");
  assert.equal(backend.list()[0].title, "Inception");
  assert.equal(backend.persistable().length, 1);
  assert.deepEqual(backend.persistable()[0].movedFiles, f.rec.movedFiles);
  assert.equal(await backend.stopSeeding(f.rec.infoHash), true);
  assert.equal(backend.list()[0].state, "completed");
  assert.deepEqual(await fsp.readFile(f.rec.movedTo), Buffer.from(f.buffers[0]));
});

test("all three download backends use the read-only seed flow for imported history", async (t) => {
  for (const Backend of [WebTorrentBackend, NativeTorrentBackend, LibtorrentBackend]) {
    const f = await fixture(t);
    const backend = new Backend(f.cfg);
    backend._clientGet = () => null;
    backend._manualSeedClient = async () => f.client;
    backend.restoreImported(f.rec);
    assert.equal(await backend.startSeeding(f.rec.infoHash), true);
    await until(() => backend.importedSummary(f.rec).seedStatus?.state === "full", `${Backend.name} must seed`);
    assert.equal(await backend.stopSeeding(f.rec.infoHash), true);
  }
});

test("legacy history without mappings or metadata fails explicitly", async (t) => {
  const f = await fixture(t);
  f.seed.start({ ...f.rec, movedFiles: undefined });
  await until(() => f.seed.report(f.rec.infoHash).state === "unavailable", "legacy mapping failure");
  assert.equal(f.seed.report(f.rec.infoHash).reason, "paths");
  const { TORRENT_CACHE_DIR } = await import("../engine/src/config.mjs");
  await fsp.unlink(path.join(TORRENT_CACHE_DIR, `${f.rec.infoHash}.torrent`));
  f.seed.start(f.rec);
  await until(() => f.seed.report(f.rec.infoHash).state === "unavailable", "missing metainfo failure");
  assert.equal(f.seed.report(f.rec.infoHash).reason, "metadata");
});

test("read-only store rejects writes and detects a file replaced during seed", async (t) => {
  const f = await fixture(t);
  const store = new ReadOnlySeedStore(16384, { length: f.parsed.length, files: f.parsed.files, mapping: new Map(f.rec.movedFiles.map((file) => [file.originalPath, file.path])), roots: [f.cfg.completedPath], imported: true });
  const read = () => new Promise((resolve, reject) => store.get(0, (err, bytes) => err ? reject(err) : resolve(bytes)));
  assert.deepEqual(await read(), f.buffers[0].subarray(0, 16384));
  await assert.rejects(new Promise((resolve, reject) => store.put(0, Buffer.alloc(16384), (err) => err ? reject(err) : resolve())), /seed_read_only/);
  await fsp.writeFile(f.rec.movedTo, Buffer.alloc(f.buffers[0].length));
  await assert.rejects(read(), /seed_file_changed/);
  await new Promise((resolve) => store.destroy(resolve));
  assert.equal((await fsp.stat(f.rec.movedTo)).size, f.buffers[0].length);
});

test("path traversal and sources outside configured roots cannot be read", async (t) => {
  for (const name of ["../movie.mkv", "C:\\movie.mkv", "/movie.mkv", "pack/../../movie.mkv"]) assert.equal(torrentPath(name), null);
  const f = await fixture(t);
  const store = new ReadOnlySeedStore(16384, { length: f.parsed.length, files: f.parsed.files, mapping: new Map(f.rec.movedFiles.map((file) => [file.originalPath, file.path])), roots: [f.cfg.downloadPath], imported: true });
  await assert.rejects(new Promise((resolve, reject) => store.get(0, (err, bytes) => err ? reject(err) : resolve(bytes))), /seed_path_outside_library/);
});

test("final replacement path updates both import history and persisted seed mapping", async (t) => {
  const f = await fixture(t);
  const backend = new AbstractBackend(f.cfg);
  const old = f.rec.movedTo, final = path.join(f.cfg.completedPath, "Inception (2010).mkv");
  backend.importedHistory.set(f.rec.infoHash, structuredClone(f.rec));
  backend.meta.set(f.rec.infoHash, { completed: true, movedFiles: structuredClone(f.rec.movedFiles), movedTo: old });
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, seedPaths: [{ from: old, to: final }] }));
  await backend._notifyLibrary("movie:inception", backend.meta.get(f.rec.infoHash).movedFiles, f.rec.infoHash);
  backend._clientList = () => [];
  assert.equal(backend.persistable()[0].movedFiles[0].path, final);
  assert.equal(backend.meta.get(f.rec.infoHash).movedTo, final);
});

test("complete import moves a movie, retains metainfo and mapping, then seeds after a process restart", async (t) => {
  const f = await fixture(t);
  const download = path.join(f.cfg.downloadPath, f.parsed.files[0].path);
  await fsp.writeFile(download, f.buffers[0]);
  const backend = new WebTorrentBackend(f.cfg);
  backend.client = { torrents: [] };
  backend.meta.set(f.rec.infoHash, { title: "Inception", year: 2010, addedAt: Date.now(), completed: false });
  const snapshot = { infoHash: f.rec.infoHash, name: f.parsed.name, length: f.parsed.length, files: f.parsed.files.map((file) => ({ ...file, name: path.basename(file.path), selected: true })), magnetURI: null };
  await backend._finish(snapshot, false);
  const saved = backend.persistable()[0];
  assert.equal(saved.movedFiles[0].originalPath, f.parsed.files[0].path);
  assert.equal(path.isAbsolute(saved.movedFiles[0].path), true);
  assert.deepEqual(await fsp.readFile(saved.movedFiles[0].path), Buffer.from(f.buffers[0]));
  assert.equal(await fsp.access(download).then(() => true, () => false), false);
  const { TORRENT_CACHE_DIR } = await import("../engine/src/config.mjs");
  assert.deepEqual(await fsp.readFile(path.join(TORRENT_CACHE_DIR, `${f.rec.infoHash}.torrent`)), Buffer.from(f.metainfo));
  const restored = new WebTorrentBackend(f.cfg);
  restored.client = f.client;
  restored.restoreImported(saved);
  assert.equal(await restored.startSeeding(f.rec.infoHash), true);
  await until(() => restored.list()[0].seedStatus?.state === "full", "imported and restored movie must seed");
  assert.equal(await restored.remove(f.rec.infoHash, true), true);
  assert.deepEqual(await fsp.readFile(saved.movedFiles[0].path), Buffer.from(f.buffers[0]));
  assert.deepEqual(restored.persistable(), []);
  assert.equal(await fsp.access(path.join(TORRENT_CACHE_DIR, `${f.rec.infoHash}.torrent`)).then(() => true, () => false), false);
});

test("an upload read after a file change stops the seed and leaves the changed file intact", async (t) => {
  const f = await fixture(t);
  f.seed.start(f.rec);
  await until(() => f.seed.report(f.rec.infoHash).state === "full", "initial verification");
  const torrent = f.seed.sessions.get(f.rec.infoHash).torrent;
  await fsp.writeFile(f.rec.movedTo, Buffer.alloc(f.buffers[0].length));
  await assert.rejects(new Promise((resolve, reject) => torrent.store.get(0, (err, bytes) => err ? reject(err) : resolve(bytes))), /seed_file_changed/);
  await until(() => f.seed.report(f.rec.infoHash).state === "unavailable" && f.client.torrents.length === 0, "changed source must stop sharing");
  assert.deepEqual(await fsp.readFile(f.rec.movedTo), Buffer.alloc(f.buffers[0].length));
});

test("renamed S01E01 imports into its season folder and seeds from the persisted original path", async (t) => {
  const f = await fixture(t, ["Breaking.Bad.S01E01.1080p-GROUP.mkv"]);
  f.cfg.category = "series";
  await fsp.writeFile(path.join(f.cfg.downloadPath, f.parsed.files[0].path), f.buffers[0]);
  const backend = new WebTorrentBackend(f.cfg);
  backend.client = { torrents: [] };
  backend.meta.set(f.rec.infoHash, { title: "Breaking Bad", year: 2008, addedAt: Date.now(), completed: false, episodeTarget: { season: 1, episode: 1 } });
  await backend._finish({ infoHash: f.rec.infoHash, name: f.parsed.name, length: f.parsed.length, files: f.parsed.files.map((file) => ({ ...file, name: path.basename(file.path), selected: true })) }, false);
  const saved = backend.persistable()[0];
  assert.match(saved.movedFiles[0].path, /Breaking Bad.*Season 01.*S01E01/);
  assert.equal(saved.movedFiles[0].originalPath, f.parsed.files[0].path);
  const restored = new WebTorrentBackend(f.cfg);
  restored.client = f.client;
  restored.restoreImported(saved);
  await restored.startSeeding(f.rec.infoHash);
  await until(() => restored.list()[0].seedStatus?.state === "full", "renamed episode must verify after restoration");
  await restored.stopSeeding(f.rec.infoHash);
  assert.deepEqual(await fsp.readFile(saved.movedFiles[0].path), Buffer.from(f.buffers[0]));
});

test("seed API reports rejected actions as failures", async (t) => {
  const { createApiServer } = await import("../engine/src/api.mjs");
  const { ENGINE_TOKEN } = await import("../engine/src/config.mjs");
  const { server } = createApiServer({ startSeeding: async () => false, stopSeeding: async () => true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/torrents/${"a".repeat(40)}/seed`;
  const headers = { "content-type": "application/json", "x-movviz-token": ENGINE_TOKEN };
  const start = await fetch(url, { method: "POST", headers, body: JSON.stringify({ on: true }) });
  assert.equal(start.status, 409);
  assert.deepEqual(await start.json(), { ok: false });
  const stop = await fetch(url, { method: "POST", headers, body: JSON.stringify({ on: false }) });
  assert.equal(stop.status, 200);
  assert.deepEqual(await stop.json(), { ok: true });
});
