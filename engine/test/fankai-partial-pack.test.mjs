import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import parseTorrent, { toTorrentFile } from "parse-torrent";

test("a Fan-Kai intégrale reopens for its 29 missing parts and keeps its 7 existing files", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-fankai-retry-"));
  t.after(async () => {
    const target = path.resolve(root);
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("movviz-fankai-retry-")) {
      throw new Error("unsafe Fan-Kai test cleanup");
    }
    await fsp.rm(target, { recursive: true, force: true });
  });
  process.env.MOVVIZ_CONFIG_DIR = path.join(root, "config");
  process.env.MOVVIZ_DATA_DIR = root;
  const { AbstractBackend } = await import("../src/backends/AbstractBackend.mjs");
  const title = "Naruto Shippuden Yabaï";
  const cfg = { id: "series", category: "series", downloadPath: path.join(root, "downloads"), completedPath: path.join(root, "library") };
  await fsp.mkdir(cfg.completedPath);
  const parts = Array.from({ length: 36 }, (_, i) => i + 1);
  const names = parts.map(part => [
    `Saison ${Math.ceil(part / 7)}`,
    `[Triggerforce] ${title} - ${String(part).padStart(2, "0")} - Film ${part} - 1080p.mkv`,
  ]);
  const bytes = Buffer.from(toTorrentFile({
    info: {
      name: Buffer.from(title), "piece length": 16384, pieces: Buffer.alloc(20),
      files: names.map(segments => ({ length: 8, path: segments.map(segment => Buffer.from(segment)) })),
    },
  }));
  const torrent = await parseTorrent(bytes);
  const { infoHash, files } = torrent;
  const existingFiles = [];
  for (const [index, file] of files.slice(0, 7).entries()) {
    const imported = path.join(cfg.completedPath, `Episode ${index + 1}.mkv`);
    await fsp.writeFile(imported, "original");
    existingFiles.push({ path: imported, originalPath: file.path, size: 8, season: 1, episode: index + 1 });
  }

  const backend = new AbstractBackend(cfg);
  const libraryRef = "season:naruto-fankai:1";
  const history = { infoHash, size: torrent.length, name: title, libraryRef, movedTo: existingFiles[0].path, movedFiles: existingFiles };
  backend.restoreImported(history);
  let live = torrent;
  let adds = 0;
  let selected;
  let notified;
  backend.meta.set(infoHash, { completed: true, notifiedLibrary: true, movedTo: history.movedTo });
  backend._clientGet = () => live;
  backend._clientList = () => live ? [live] : [];
  backend._clientRemove = async (_hash, deleteData) => {
    assert.equal(deleteData, false);
    live = null;
    return true;
  };
  backend._clientAdd = async () => { adds++; live = torrent; return live; };
  backend._clientWireEvents = () => {};
  backend._clientSelectFiles = (_handle, indexes) => { selected = indexes; };
  backend.summary = () => ({ infoHash, state: backend.meta.get(infoHash).completed ? "completed" : "downloading" });
  backend._notifyLibrary = async (_ref, moved) => { notified = moved; return true; };

  const opts = { libraryRef, title, episodeTargets: parts.map(episode => ({ season: 1, episode, fanVersion: true })) };
  assert.equal((await backend.add(bytes, { ...opts, episodeTargets: [{ season: 1, episode: 37, fanVersion: true }] })).state, "completed");
  assert.equal(adds, 0);
  const [first, second] = await Promise.all([backend.add(bytes, opts), backend.add(bytes, opts)]);
  assert.equal(first.state, "downloading");
  assert.deepEqual(second, first);
  assert.equal(adds, 1);
  assert.deepEqual([...selected].map(index => index + 1), parts.slice(7));
  assert.equal(backend.persistable()[0].previousFanKaiFiles.length, 7);

  const snap = { ...torrent, files: files.map((file, i) => ({ ...file, selected: selected.has(i) })) };
  await backend._import(snap, async (_source, dest) => {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, "new part");
  });
  assert.deepEqual(notified.map(file => [file.season, file.episode]), parts.slice(7).map(part => [1, part]));
  assert.equal(backend.importedHistory.get(infoHash).movedFiles.length, 36);
  for (const file of existingFiles) assert.equal(await fsp.readFile(file.path, "utf8"), "original");

  live = null;
  assert.equal((await backend.add(`magnet:?xt=urn:btih:${infoHash}`, opts)).state, "completed");
  assert.equal(adds, 1);
});
