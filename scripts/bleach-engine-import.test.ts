import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { LibrarySeries, LibraryEpisode } from "@/lib/library/types";
import { decodeLibraryRef } from "@/lib/library/types";

test("real engine source selection → Plex physical name → operational library import, replacement and replay", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-bleach-import-"));
  const config = path.join(sandbox, "config"), root = path.join(sandbox, "library"), download = path.join(sandbox, "downloads");
  await Promise.all([config, root, download].map(p => fsp.mkdir(p, { recursive: true })));
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR, previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  let flush = () => {};
  try {
    const store = await import("@/lib/library/store");
    const { applyImportedFiles, validateBleachImportedFiles } = await import("@/lib/library/applyImportedFiles");
    const { planBleachEngineTargets, markBleachGrabTargets, prepareBleachGrab } = await import("@/lib/library/bleachEngine");
    const cache = await import("@/lib/fsJsonCache"); flush = cache.flushPendingJsonWritesSync;
    const { inspectBleachRepairState } = await import("@/lib/library/bleachRepairState");
    const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
    const { movePath } = await import("../engine/src/store.mjs");
    const oldPath = path.join(root, "Bleach", "Season 17", "Bleach - S17E14.mkv");
    await fsp.mkdir(path.dirname(oldPath), { recursive: true }); await fsp.writeFile(oldPath, "old TYBW copy");
    const episode = (seasonNumber: number, episodeNumber: number): LibraryEpisode => ({ seasonNumber, episodeNumber, title: "fixture", airDate: null, monitored: true, status: "missing", activeInfoHash: null, file: null, plexRatingKey: null });
    const original = episode(2, 1);
    const sequel = episode(17, 14); sequel.file = { path: oldPath, size: 13, addedAt: 1, quality: "old", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null }; sequel.status = "available";
    store.addSeries({ id: "sr_bleach_test", tmdbId: 30984, tvdbId: 74796, title: "Bleach", year: 2004, episodeOrder: "tvdb", monitored: true, qualityProfileId: "default", addedAt: 1, seasons: [
      { seasonNumber: 2, name: "Original", monitored: true, episodes: [original] },
      { seasonNumber: 11, name: "Original", monitored: true, episodes: [episode(11, 1)] },
      { seasonNumber: 17, name: "TYBW", monitored: true, episodes: Array.from({ length: 26 }, (_, i) => i === 13 ? sequel : episode(17, i + 1)) },
    ] } as LibrarySeries);
    const title = "Bleach.Thousand-Year.Blood.War.The.Separation.S02E01.1080p.WEB-DL.x265";
    const targets = planBleachEngineTargets([{ season: 17, episode: 14 }], title, "tmdbAiring");
    assert.deepEqual(targets[0], { season: 2, episode: 1, library: { season: 17, episode: 14 }, placement: { season: 2, episode: 14 } });
    assert.deepEqual(planBleachEngineTargets([{ season: 11, episode: 1 }], "Bleach.S11.COMPLETE", "tmdbAiring")[0].placement, { season: 1, episode: 206 });
    assert.equal(planBleachEngineTargets([{ season: 17, episode: 1 }], "Bleach.S02.COMPLETE", "tmdbAiring").length, 0);
    const part = planBleachEngineTargets(Array.from({ length: 40 }, (_, i) => ({ season: 17, episode: i + 1 })), "Bleach.Thousand-Year.Blood.War.The.Separation.S02.COMPLETE", "tmdbAiring");
    assert.equal(part.length, 13); assert.equal(part[0].library?.episode, 14); assert.equal(part.at(-1)?.library?.episode, 26);
    let postCount = 0, outdated = false;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) return Response.json({ capabilities: outdated ? { episodePlacementV1: true } : { episodePlacementV1: true, episodePresentationV1: true } });
      if (url.includes("/api/library/import")) {
        postCount++;
        const body = JSON.parse(String(init?.body));
        const result = await applyImportedFiles(decodeLibraryRef(body.libraryRef)!, body.files, body.infoHash);
        return Response.json(result);
      }
      if (url.endsWith("/instances")) return Response.json({ instances: [{ completedPath: root }] });
      return Response.json({});
    };
    outdated = true;
    await assert.rejects(prepareBleachGrab("episode:sr_bleach_test:17:14", title, targets[0]), /bleach_engine_update_required/);
    outdated = false;
    markBleachGrabTargets("sr_bleach_test", "fixture-hash", targets);
    const pending = store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === 17)!.episodes[13];
    assert.deepEqual(pending.activeReleaseEpisode, { seasonNumber: 2, episodeNumber: 1 });
    const sourceName = `${title}.mkv`, source = path.join(download, sourceName);
    await fsp.writeFile(source, "actual fixture TYBW bytes");
    const backend = new AbstractBackend({ id: "bleach-test", category: "series", completedPath: root, downloadPath: download, seedRatio: 0 });
    backend.meta.set("fixture-hash", { title: "Bleach", libraryRef: "episode:sr_bleach_test:17:14", episodeTarget: targets[0], addedAt: 1 });
    await backend._import({ infoHash: "fixture-hash", name: sourceName, files: [{ name: sourceName, path: sourceName, length: Buffer.byteLength("actual fixture TYBW bytes"), selected: true }] }, movePath);
    assert.equal(postCount, 1);
    const installed = store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === 17)!.episodes[13];
    assert.equal(installed.status, "available"); assert.match(installed.file!.path, /Season 02.*S02E14/);
    assert.equal(await fsp.readFile(installed.file!.path, "utf8"), "actual fixture TYBW bytes");
    await assert.rejects(fsp.access(oldPath));
    assert.equal(store.getSeries("sr_bleach_test")!.seasons[0].episodes[0].status, "missing");
    const files = backend.meta.get("fixture-hash").movedFiles;
    assert.equal(files[0].season, 17); assert.equal(files[0].episode, 14); assert.equal(files[0].originalPath, sourceName);
    assert.equal(await backend._notifyLibrary("episode:sr_bleach_test:17:14", files, "fixture-hash"), true);
    assert.equal(store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === 17)!.episodes[13].file!.path, installed.file!.path);
    // A collision suffix stays on disk; the callback never moves a seeded target.
    const collision = installed.file!.path.replace(/\.mkv$/, " (2).mkv");
    await fsp.writeFile(collision, "upgraded fixture TYBW");
    markBleachGrabTargets("sr_bleach_test", "upgrade-hash", targets);
    const collisionFile = { ...files[0], path: collision, size: Buffer.byteLength("upgraded fixture TYBW") };
    await applyImportedFiles({ kind: "episode", seriesId: "sr_bleach_test", season: 17, episode: 14 }, [collisionFile], "upgrade-hash");
    assert.equal(store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === 17)!.episodes[13].file!.path, collision);
    assert.equal(await fsp.readFile(collision, "utf8"), "upgraded fixture TYBW");
    // Validate a contiguous combined episode callback, including the parser's
    // terminal -E15 release-group edge case.
    markBleachGrabTargets("sr_bleach_test", "range-hash", planBleachEngineTargets([{ season: 17, episode: 14 }, { season: 17, episode: 15 }], "Bleach.Thousand-Year.Blood.War.The.Separation.S02.COMPLETE", "tmdbAiring"));
    const rangePath = path.join(root, "Bleach", "Season 02", "Bleach - S02E14-E15.mkv"); await fsp.writeFile(rangePath, "combined");
    const range = { ...collisionFile, path: rangePath, size: 8, episodeEnd: 15, episodePlacement: { source: { season: 2, episode: 1, episodeEnd: 2 }, library: { season: 17, episode: 14, episodeEnd: 15 }, placement: { season: 2, episode: 14, episodeEnd: 15 } } };
    const rangeResult = await applyImportedFiles({ kind: "season", seriesId: "sr_bleach_test", season: 17 }, [range], "range-hash");
    assert.equal(rangeResult.ok, true);
    assert.equal(store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === 17)!.episodes[14].file!.path, rangePath);
    assert.throws(() => validateBleachImportedFiles(store.getSeries("sr_bleach_test")!, [{ ...range, episodePlacement: { ...range.episodePlacement, library: { season: 17, episode: 1, episodeEnd: Infinity } } }], "range-hash"), /identity_unverified/);
    assert.throws(() => validateBleachImportedFiles(store.getSeries("sr_bleach_test")!, [{ ...range, episodePlacement: undefined }], "range-hash"), /identity_unverified/);
    // New downloads use two physical series identities. Legacy imports above
    // remain valid; neither the canonical ID nor historical files are guessed.
    const beforeOriginal = JSON.stringify(store.getSeries("sr_bleach_test")!.seasons[0]);
    const destinations: string[] = [];
    for (const [season, number, release, hash] of [
      [17, 16, "Bleach.TYBW.The.Separation.S02E03.1080p", "separate-sequel"],
      [11, 1, "Bleach.S11E01.1080p", "separate-original"],
    ] as const) {
      const libraryRef = `episode:sr_bleach_test:${season}:${number}`;
      const planned = await prepareBleachGrab(libraryRef, release);
      assert.equal(planned.targets?.length, 1);
      markBleachGrabTargets("sr_bleach_test", hash, planned.targets!);
      const name = `${release}.mkv`, bytes = `synthetic ${hash}`;
      await fsp.writeFile(path.join(download, name), bytes);
      backend.meta.set(hash, { title: "Bleach", libraryRef, episodeTarget: planned.single, addedAt: 2 });
      await backend._import({ infoHash: hash, name, files: [{ name, path: name, length: Buffer.byteLength(bytes), selected: true }] }, movePath);
      const installedPart = store.getSeries("sr_bleach_test")!.seasons.find(s => s.seasonNumber === season)!.episodes.find(e => e.episodeNumber === number)!;
      assert.equal(installedPart.status, "available");
      assert.equal(await fsp.readFile(installedPart.file!.path, "utf8"), bytes);
      const folder = path.dirname(path.dirname(installedPart.file!.path)); destinations.push(folder);
      assert.equal(path.basename(folder), planned.single!.presentation!.folder);
      assert.match(await fsp.readFile(path.join(folder, ".plexmatch"), "utf8"), new RegExp(`imdbid: ${planned.single!.presentation!.imdbId}`));
      if (season === 17) assert.match(installedPart.file!.path, /Season 02.*S02E03/);
      else assert.match(installedPart.file!.path, /Season 01.*S01E206/);
      const files = backend.meta.get(hash).movedFiles;
      assert.equal(await backend._notifyLibrary(libraryRef, files, hash), true);
      assert.throws(() => validateBleachImportedFiles(store.getSeries("sr_bleach_test")!, [{ ...files[0], path: path.join(root, "Wrong Bleach", path.basename(path.dirname(files[0].path)), path.basename(files[0].path)) }], hash), /folder_unverified/);
    }
    assert.notEqual(destinations[0], destinations[1]);
    assert.equal(JSON.stringify(store.getSeries("sr_bleach_test")!.seasons[0]), beforeOriginal);
    cache.writeJsonCached(path.join(config, "playback-progress.json"), { sessions: { stale: { mediaId: "sr_bleach_test:17:14", lastHeartbeatAt: Date.now() - 25 * 60 * 60_000 } } });
    flush();
    assert.equal(inspectBleachRepairState("sr_bleach_test").blockers.includes("active_playback"), false);
    cache.writeJsonCached(path.join(config, "playback-progress.json"), { sessions: { active: { mediaId: "sr_bleach_test:17:14", lastHeartbeatAt: Date.now() } } });
    assert.equal(inspectBleachRepairState("sr_bleach_test").blockers.includes("active_playback"), true);
    // Adding TYBW to an original-only catalogue must fill an empty placeholder
    // in the same record, retaining the original file/history coordinates.
    const preserved = store.getSeries("sr_bleach_test")!;
    store.updateSeries(preserved.id, { seasons: [preserved.seasons[0], { seasonNumber: 17, name: "placeholder", monitored: true, episodes: [] }] });
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes("/tv/30984/season/2")) return Response.json({ season_number: 2, name: "TYBW", episodes: Array.from({ length: 53 }, (_, i) => ({ season_number: 2, episode_number: i + 1, name: `TYBW ${i + 1}`, air_date: "2022-10-11" })) });
      throw new Error(`Unexpected request while filling Bleach placeholder: ${new URL(url).pathname}`);
    };
    const { requestMedia } = await import("@/lib/requests/requestMedia");
    const addedPart = await requestMedia({ id: "fixture-admin", username: "QA", role: "admin" } as import("@/lib/auth/types").User, "series", 30984, undefined, undefined, { seriesPart: "tybw", skipSearch: true });
    assert.ok("added" in addedPart);
    const filled = store.getSeries(preserved.id)!;
    assert.equal(filled.id, preserved.id);
    assert.deepEqual(filled.seasons[0], preserved.seasons[0]);
    assert.equal(filled.seasons.find(s => s.seasonNumber === 17)!.episodes.length, 50);
    assert.equal(store.loadSeries().filter(s => s.tmdbId === 30984).length, 1);
  } finally {
    flush(); globalThis.fetch = previousFetch;
    // requestMedia records activity in SQLite; close the test-owned handle
    // before Windows can remove its isolated config directory.
    const contextDb = globalThis as typeof globalThis & { __movvizUserContextDb?: import("node:sqlite").DatabaseSync | null };
    contextDb.__movvizUserContextDb?.close(); contextDb.__movvizUserContextDb = null;
    if (previousConfig == null) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    const target = path.resolve(sandbox), temp = path.resolve(os.tmpdir());
    if (!target.startsWith(temp + path.sep) || path.dirname(target) !== temp || !path.basename(target).startsWith("movviz-bleach-import-")) throw new Error("unsafe test cleanup");
    await fsp.rm(target, { recursive: true, force: true });
  }
});
