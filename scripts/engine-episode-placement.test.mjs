import test, { after } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Synthetic bytes only. Never load the installed engine state or any media.
const root = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-placement-test-"));
process.env.MOVVIZ_CONFIG_DIR = path.join(root, "config");
process.env.MOVVIZ_DATA_DIR = root;
await fsp.mkdir(process.env.MOVVIZ_CONFIG_DIR);
after(async () => {
  const target = path.resolve(root), temp = path.resolve(os.tmpdir());
  if (path.dirname(target) !== temp || !path.basename(target).startsWith("movviz-placement-test-") || target.split(path.sep).filter(Boolean).length < 3) throw new Error("unsafe placement test cleanup");
  await fsp.rm(target, { recursive: true, force: true });
});
const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
const { movePath, linkOrCopy } = await import("../engine/src/store.mjs");
const { ReadOnlySeedStore } = await import("../engine/src/manualSeed.mjs");
const { validateEpisodeTargets, resolveEpisodePlacement, ensurePresentationFolder } = await import("../engine/src/episodePlacement.mjs");
const target = (s, e, ls, le, ps, pe) => ({ season: s, episode: e, library: { season: ls, episode: le }, placement: { season: ps, episode: pe } });

async function fixture(names, targets, naming = {}) {
  const folder = await fsp.mkdtemp(path.join(root, "case-"));
  const cfg = { id: "series", category: "series", downloadPath: path.join(folder, "downloads"), completedPath: path.join(folder, "library") };
  await Promise.all([fsp.mkdir(cfg.downloadPath), fsp.mkdir(cfg.completedPath)]);
  await fsp.writeFile(path.join(process.env.MOVVIZ_CONFIG_DIR, "naming.json"), JSON.stringify(naming));
  const bytes = Buffer.from("Synthetic episode content; placement must preserve every byte.");
  const files = [];
  for (const name of names) {
    const relative = path.join("Bleach Pack", name);
    await fsp.mkdir(path.dirname(path.join(cfg.downloadPath, relative)), { recursive: true });
    await fsp.writeFile(path.join(cfg.downloadPath, relative), bytes);
    files.push({ name, path: relative, length: bytes.length, selected: true });
  }
  const backend = new AbstractBackend(cfg);
  backend._clientList = () => [];
  backend.meta.set("placement-hash", { title: "Bleach", year: 2004, addedAt: Date.now(), completedAt: Date.now(), episodeTargets: targets, libraryRef: "series:bleach" });
  const snap = { infoHash: "placement-hash", name: "Bleach Pack", length: bytes.length * files.length, files };
  return { cfg, backend, snap, bytes };
}

test("placement rejects invalid or conflicting identities and incomplete multi-episode coverage", () => {
  assert.throws(() => validateEpisodeTargets([target(2, 1, 17, 14, -1, 14)]), /invalid_episode_placement/);
  assert.throws(() => validateEpisodeTargets([target(2, 1, 17, 14, 2, 14), target(2, 1, 17, 15, 2, 15)]), /conflicting_episode_placement/);
  assert.throws(() => resolveEpisodePlacement([target(2, 1, 17, 14, 2, 14)], { season: 2, episode: 1, episodeEnd: 2 }), /partial_multi_episode_placement/);
  assert.throws(() => resolveEpisodePlacement([target(1, 20, 1, 20, 1, 20), target(1, 21, 2, 1, 1, 21)], { season: 1, episode: 20, episodeEnd: 21 }), /non_contiguous_episode_placement/);
});

test("standalone sequel imports to its own GUID-hinted folder without altering source or canonical numbering", async t => {
  const presentation = { seriesPart: "tybw", title: "Bleach - Thousand-Year Blood War", year: 2022, folder: "Bleach - Thousand-Year Blood War (2022) {imdb-tt14986406}", plexGuid: "plex://show/68ae02ab39b1f79ac7d49761" };
  const f = await fixture(["Bleach.TYBW.S02E01.mkv"], [{ ...target(2, 1, 17, 14, 2, 1), presentation }], { seriesFolder: "{title}", enabled: false });
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => { payload = JSON.parse(init.body); return Response.json({ ok: true }); });
  await f.backend._import(f.snap, movePath);
  const moved = f.backend.persistable()[0].movedFiles[0];
  assert.equal(path.basename(path.dirname(path.dirname(moved.path))), presentation.folder);
  assert.match(moved.path, /Season 02.*S02E01/);
  assert.deepEqual([moved.season, moved.episode], [17, 14]);
  assert.deepEqual(payload.files[0].episodePlacement.presentation, presentation);
  assert.match(await fsp.readFile(path.join(f.cfg.completedPath, presentation.folder, ".plexmatch"), "utf8"), /guid: plex:\/\/show\/68ae02ab39b1f79ac7d49761/);
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
  await ensurePresentationFolder(f.cfg.completedPath, presentation);
});

test("a conflicting Plex hint or unsafe folder rejects before any episode moves", async () => {
  const presentation = { seriesPart: "tybw", title: "TYBW", year: 2022, folder: "TYBW (2022)", plexGuid: "plex://show/68ae02ab39b1f79ac7d49761" };
  const f = await fixture(["Bleach.TYBW.S02E01.mkv"], [{ ...target(2, 1, 17, 14, 2, 1), presentation }]);
  const folder = path.join(f.cfg.completedPath, presentation.folder);
  await fsp.mkdir(folder); await fsp.writeFile(path.join(folder, ".plexmatch"), "tmdbid: 30984\n");
  let transfers = 0;
  await assert.rejects(f.backend._import(f.snap, async () => { transfers++; }), /hint_conflict/);
  assert.equal(transfers, 0);
  assert.deepEqual(await fsp.readFile(path.join(f.cfg.downloadPath, f.snap.files[0].path)), f.bytes);
  for (const invalid of ["../Bleach", "nested/show", "C:\\Bleach"]) await assert.rejects(ensurePresentationFolder(f.cfg.completedPath, { ...presentation, folder: invalid }), /invalid_episode_presentation/);
});

test("historical S11E01 imports as TMDb S01E206 while callback retains library S11E01", async t => {
  const f = await fixture(["Bleach.S11E01.mkv"], [target(11, 1, 11, 1, 1, 206)]);
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => { payload = JSON.parse(init.body); return Response.json({ ok: true }); });
  await f.backend._import(f.snap, movePath);
  const moved = f.backend.persistable()[0].movedFiles[0];
  assert.match(moved.path, /Season 01.*S01E206/);
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
  assert.equal(moved.season, 11);
  assert.equal(moved.episode, 1);
  assert.deepEqual(payload.files[0].episodePlacement, { source: { season: 11, episode: 1 }, library: { season: 11, episode: 1 }, placement: { season: 1, episode: 206 } });
});

test("TYBW part two source S02E01 becomes physical S02E14 and operational S17E14 with naming disabled", async t => {
  const f = await fixture(["Bleach.The.Separation.S02E01.mkv"], [target(2, 1, 17, 14, 2, 14)], { enabled: false });
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await f.backend._import(f.snap, movePath);
  const moved = f.backend.persistable()[0].movedFiles[0];
  assert.match(moved.path, /Season 02.*S02E14/);
  assert.deepEqual([moved.season, moved.episode], [17, 14]);
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
  assert.match(moved.originalPath, /Bleach.The.Separation.S02E01.mkv$/);
});

test("custom templates cannot hide physical coordinates of an explicit placement", async t => {
  const f = await fixture(["Bleach.S11E01.mkv"], [target(11, 1, 11, 1, 1, 206)], { seasonFolder: "Unsorted", episodeFile: "{title}" });
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await f.backend._import(f.snap, movePath);
  assert.match(f.backend.persistable()[0].movedFiles[0].path, /Season 01.*S01E206/);
});

test("a TYBW cour pack imports its 13 source episodes as library 14–26, without covering the whole sequel", async t => {
  const names = Array.from({ length: 13 }, (_, i) => `Bleach.The.Separation.S02E${String(i + 1).padStart(2, "0")}.mkv`);
  const targets = names.map((_, i) => target(2, i + 1, 17, i + 14, 2, i + 14));
  const f = await fixture(names, targets);
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => { payload = JSON.parse(init.body); return Response.json({ ok: true }); });
  await f.backend._import(f.snap, movePath);
  const saved = f.backend.persistable()[0];
  assert.equal(payload.files.length, 13);
  assert.deepEqual(saved.movedFiles.map(file => [file.season, file.episode]), Array.from({ length: 13 }, (_, i) => [17, i + 14]));
  for (const [i, file] of saved.movedFiles.entries()) {
    assert.equal(file.episodePlacement.source.episode, i + 1);
    assert.equal(file.episodePlacement.placement.episode, i + 14);
    assert.deepEqual(await fsp.readFile(file.path), f.bytes);
  }
});

test("a contiguous combined file keeps both episode identities in its physical range and callback", async t => {
  const f = await fixture(["Bleach.The.Separation.S02E01-E02.1080p.mkv"], [target(2, 1, 17, 14, 2, 14), target(2, 2, 17, 15, 2, 15)]);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await f.backend._import(f.snap, movePath);
  const moved = f.backend.persistable()[0].movedFiles[0];
  assert.match(moved.path, /S02E14-E15/);
  assert.deepEqual([moved.season, moved.episode, moved.episodeEnd], [17, 14, 15]);
  assert.deepEqual(moved.episodePlacement.source, { season: 2, episode: 1, episodeEnd: 2 });
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
});

test("an unrepresentable range rejects the entire import before moving an earlier valid file", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected callback: no HTTP allowed in rejected imports"); });
  for (const rangeName of ["Bleach.S01E20-E21.1080p.mkv", "Bleach.S01E20-E21.mkv"]) {
    const f = await fixture(["Bleach.S01E01.mkv", rangeName], [target(1, 1, 1, 1, 1, 1), target(1, 20, 1, 20, 1, 20), target(1, 21, 2, 1, 1, 21)]);
    let transfers = 0;
    await assert.rejects(f.backend._import(f.snap, async () => { transfers++; }), /(?:non_contiguous|partial_multi)_episode_placement/, rangeName);
    assert.equal(transfers, 0);
    for (const file of f.snap.files) assert.deepEqual(await fsp.readFile(path.join(f.cfg.downloadPath, file.path)), f.bytes);
    assert.deepEqual(await fsp.readdir(f.cfg.completedPath), []);
  }
});

test("lost callback response survives restart with coordinates, original seed identity and library bytes", async t => {
  const f = await fixture(["Bleach.The.Separation.S02E01.mkv"], [target(2, 1, 17, 14, 2, 14)]);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("simulated callback connection loss"); });
  await f.backend._import(f.snap, linkOrCopy);
  const saved = f.backend.persistable()[0];
  assert.equal(saved.notifiedLibrary, false);
  const moved = saved.movedFiles[0];
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
  const restored = new AbstractBackend(f.cfg);
  restored._clientList = () => [];
  restored.restoreImported(JSON.parse(JSON.stringify(saved)));
  const meta = restored.meta.get(f.snap.infoHash);
  assert.ok(meta, "pending callback is restored instead of silently forgotten");
  assert.deepEqual(meta.episodeTargets, f.backend.meta.get(f.snap.infoHash).episodeTargets);
  let replay;
  t.mock.method(globalThis, "fetch", async (_url, init) => { replay = JSON.parse(init.body); return Response.json({ ok: true }); });
  assert.equal(await restored._notifyLibrary(meta.libraryRef, meta.movedFiles, f.snap.infoHash), true);
  assert.deepEqual(replay.files[0].episodePlacement, moved.episodePlacement);
  assert.equal(restored.persistable()[0].movedFiles[0].originalPath, moved.originalPath);
  // Manual seeding reads the persisted original→library map, including on
  // Windows hosts that lack file-symlink privileges. No tracker is contacted.
  const store = new ReadOnlySeedStore(f.bytes.length, { length: f.bytes.length, files: [{ path: moved.originalPath, length: f.bytes.length, offset: 0 }], mapping: new Map([[moved.originalPath, moved.path]]), roots: [f.cfg.completedPath], imported: true });
  try {
    assert.deepEqual(await new Promise((resolve, reject) => store.get(0, (error, bytes) => error ? reject(error) : resolve(bytes))), f.bytes);
  } finally { await new Promise(resolve => store.destroy(resolve)); }
  assert.deepEqual(await fsp.readFile(moved.path), f.bytes);
});
