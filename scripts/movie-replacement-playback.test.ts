import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("Inception reste lisible pendant le remplacement, sans résidu après import", async t => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-movie-replace-"));
  const root = path.join(sandbox, "library"), folder = path.join(root, "Inception"), config = path.join(sandbox, "config");
  await fsp.mkdir(folder, { recursive: true });
  await fsp.mkdir(config, { recursive: true });
  process.env.MOVVIZ_CONFIG_DIR = config;
  await fsp.writeFile(path.join(config, "engine-state.json"), JSON.stringify({ instances: { movies: { completedPath: root } } }));
  const old = path.join(folder, "Inception-1080p.mkv"), incoming = path.join(folder, "Inception-2160p (2).mkv"), final = path.join(folder, "Inception-2160p.mkv");
  await fsp.writeFile(old, "ancienne version");
  await fsp.writeFile(incoming, "nouvelle version");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ instances: [{ completedPath: root }] });
  const [{ addMovie, getMovie }, { applyImportedFiles }, { resolveMoviePlayback }, { alreadyAppliedMovieImport }, { flushPendingJsonWritesSync }] = await Promise.all([
    import("@/lib/library/store"), import("@/lib/library/applyImportedFiles"), import("@/lib/playback/sourceResolver"), import("@/lib/library/importRetry"), import("@/lib/fsJsonCache"),
  ]);
  try {
    addMovie({ id: "mv_inception", tmdbId: 27205, imdbId: null, title: "Inception", year: 2010, releaseDate: null, vfReleaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 8.4, runtime: 148, genres: [], monitored: true, qualityProfileId: "default", status: "available", activeInfoHash: "new-release", addedAt: Date.now(), plexRatingKey: null, plexMediaInfo: null,
      file: { path: old, diskPath: old, size: 16, addedAt: Date.now(), quality: "WEB-DL", resolution: "1080p", videoCodec: "x264", audioCodec: "AAC", hdr: null, source: "WEB-DL" } });
    const before = resolveMoviePlayback("mv_inception");
    assert.ok(before.ok);
    if (before.ok) assert.equal(before.value.path, old);
    const file = { path: incoming, size: Buffer.byteLength("nouvelle version"), quality: "WEB-DL", resolution: "2160p", videoCodec: "HEVC", audioCodec: "AAC", hdr: null, source: "WEB-DL" };
    assert.equal((await applyImportedFiles({ kind: "movie", movieId: "mv_inception" }, [file], "new-release")).ok, true);
    assert.equal(getMovie("mv_inception")?.file?.path, final);
    assert.equal(getMovie("mv_inception")?.activeInfoHash, null);
    assert.deepEqual(await fsp.readdir(folder), [path.basename(final)]);
    assert.equal(await alreadyAppliedMovieImport("mv_inception", "new-release", file), true);
    assert.equal(await alreadyAppliedMovieImport("mv_inception", "wrong-release", file), false);
    const after = resolveMoviePlayback("mv_inception");
    assert.ok(after.ok);
    if (after.ok) assert.equal(after.value.path, final);
    // Verrouillage réel simulé à l'étape de sauvegarde de l'ancien.
    const rejected = path.join(folder, "Inception-2160p (2).mkv");
    await fsp.writeFile(rejected, "troisième version");
    const rename = fsp.rename.bind(fsp);
    let now = Date.now();
    t.mock.method(Date, "now", () => now);
    t.mock.method(fsp, "rename", async (from: Parameters<typeof fsp.rename>[0], to: Parameters<typeof fsp.rename>[1]) => {
      if (String(from) === final) throw Object.assign(new Error("fichier utilisé"), { code: "EBUSY" });
      return rename(from, to);
    });
    const { ReplacementRefused } = await import("@/lib/library/replacementRetry");
    for (let attempt = 1; attempt <= 4; attempt++) {
      await assert.rejects(applyImportedFiles({ kind: "movie", movieId: "mv_inception" }, [{ ...file, path: rejected, size: Buffer.byteLength("troisième version") }], "rejected-release"), error => {
        assert.ok(error instanceof ReplacementRefused);
        assert.equal(error.failure.reason, "fileInUse");
        assert.equal(error.failure.discarded, attempt === 4);
        return true;
      });
      assert.equal(await fsp.readFile(final, "utf8"), "nouvelle version");
      now += 600_000;
    }
    assert.deepEqual(await fsp.readdir(folder), [path.basename(final)]);
    assert.equal(getMovie("mv_inception")?.file?.path, final);
    await new Promise(resolve => setTimeout(resolve, 500));
  } finally {
    flushPendingJsonWritesSync();
    globalThis.fetch = originalFetch;
    assert.ok(path.resolve(sandbox).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.match(path.basename(sandbox), /^movviz-movie-replace-/);
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});
