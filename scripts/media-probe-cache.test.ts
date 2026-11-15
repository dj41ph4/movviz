import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-probe-cache-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
const FILE = path.join(config, "media-probe-cache.json");

const { getFfprobeVersion } = await import("../src/lib/playback/engine/mediaProbe.ts");
const cache = await import("../src/lib/playback/engine/mediaProbeCache.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

const media = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-probe-media-"));
const ffprobeVersion = await getFfprobeVersion();
const descriptor = (mediaId: string) => ({ mediaId, source: { type: "local" }, container: "matroska", video: { codec: "hevc" }, audioTracks: [], subtitleTracks: [] });
const entryFor = (mediaId: string, file: string) => {
  const stat = fs.statSync(file);
  return { mediaId, path: file, size: stat.size, mtimeMs: stat.mtimeMs, probeVersion: 1, ffprobeVersion, descriptor: descriptor(mediaId), updatedAt: 1 };
};
const onDisk = () => { cache.flushMediaProbeCache(); flushPendingJsonWritesSync(); return JSON.parse(fs.readFileSync(FILE, "utf8")) as Array<{ mediaId: string; path: string }>; };

// Not media at all: any real ffprobe run on these would fail, so a returned
// descriptor proves the cache answered.
const e9 = path.join(media, "Show - S01E09.mkv"), e10 = path.join(media, "Show - S01E10.mkv"), other = path.join(media, "Other - S01E01.mkv");
for (const f of [e9, e10, other]) fs.writeFileSync(f, "not a video " + f);
fs.writeFileSync(FILE, JSON.stringify([entryFor("sr_a:s1e9", e9), entryFor("sr_a:s1e10", e10), entryFor("sr_b:s1e1", other)]));

test("a renamed, renumbered file keeps its analysis — no new ffprobe", async () => {
  // Resync: S01E09 → S02E01, S01E10 → S01E09 (ids swap inside one batch).
  const n9 = path.join(media, "Show - S02E01.mkv"), n10 = path.join(media, "Show - S01E09.mkv.tmp");
  fs.renameSync(e9, n9);
  fs.renameSync(e10, n10);
  fs.renameSync(n10, e9);
  const carried = cache.carryMediaProbeEntries([
    { fromId: "sr_a:s1e9", fromPath: e9, toId: "sr_a:s2e1", toPath: n9 },
    { fromId: "sr_a:s1e10", fromPath: e10, toId: "sr_a:s1e9", toPath: e9 },
  ]);
  assert.equal(carried, 2);
  assert.equal((await cache.getOrProbeMediaDescriptor("sr_a:s2e1", n9, false, { priority: "background" }))?.mediaId, "sr_a:s2e1");
  assert.equal((await cache.getOrProbeMediaDescriptor("sr_a:s1e9", e9, false, { priority: "background" }))?.mediaId, "sr_a:s1e9");
  assert.equal(cache.hasCachedMediaDescriptor("sr_a:s1e10"), false);
  assert.equal(cache.hasCachedMediaDescriptor("sr_b:s1e1"), true);
});

test("the file on disk gets every change in one write, other entries untouched", () => {
  const saved = onDisk();
  assert.deepEqual(saved.map((e) => e.mediaId).sort(), ["sr_a:s1e9", "sr_a:s2e1", "sr_b:s1e1"]);
  assert.equal(saved.find((e) => e.mediaId === "sr_a:s2e1")!.path, path.join(media, "Show - S02E01.mkv"));
  assert.equal(saved.find((e) => e.mediaId === "sr_b:s1e1")!.path, other);
});

test("an entry whose path is not the moved file is never carried", () => {
  assert.equal(cache.carryMediaProbeEntries([{ fromId: "sr_b:s1e1", fromPath: path.join(media, "elsewhere.mkv"), toId: "sr_b:s9e9", toPath: other }]), 0);
  assert.equal(cache.hasCachedMediaDescriptor("sr_b:s9e9"), false);
  assert.equal(cache.hasCachedMediaDescriptor("sr_b:s1e1"), true);
});

test("invalidation is visible at once and reaches the file", () => {
  cache.invalidateMediaDescriptor("sr_b:s1e1");
  assert.equal(cache.hasCachedMediaDescriptor("sr_b:s1e1"), false);
  assert.deepEqual(onDisk().map((e) => e.mediaId).sort(), ["sr_a:s1e9", "sr_a:s2e1"]);
});

test("no synchronous disk access to a media file, cached or not (a slow NAS disk must never freeze the server)", async () => {
  const real = { statSync: fs.statSync, openSync: fs.openSync, readSync: fs.readSync };
  const guard = (name: string, fn: (...a: never[]) => unknown) => (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith(media)) throw new Error(`${name} synchrone sur un média : ${args[0]}`);
    return (fn as (...a: unknown[]) => unknown)(...args);
  };
  const empty = path.join(media, "Empty - S01E01.mkv");
  fs.writeFileSync(empty, Buffer.alloc(8192));
  fs.statSync = guard("statSync", real.statSync as never) as typeof fs.statSync;
  fs.openSync = guard("openSync", real.openSync as never) as typeof fs.openSync;
  try {
    // Cached file: answered from the cache.
    const cached = path.join(media, "Show - S02E01.mkv");
    assert.equal((await cache.getOrProbeMediaDescriptor("sr_a:s2e1", cached, false, { priority: "background" }))?.mediaId, "sr_a:s2e1");
    // Never probed, pre-allocated and never filled: refused before ffprobe, without a synchronous read.
    await assert.rejects(cache.getOrProbeMediaDescriptor("sr_c:s1e1", empty, false, { priority: "background" }), /début du fichier vide/);
    // Known failure, file unchanged: skipped in the background, still without touching the disk synchronously.
    assert.equal(await cache.getOrProbeMediaDescriptor("sr_c:s1e1", empty, false, { priority: "background" }), null);
    // Missing file: null, as before.
    assert.equal(await cache.getOrProbeMediaDescriptor("sr_c:s1e2", path.join(media, "gone.mkv")), null);
  } finally {
    fs.statSync = real.statSync;
    fs.openSync = real.openSync;
  }
});
