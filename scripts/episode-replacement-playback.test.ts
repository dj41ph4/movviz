import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("S04E15 revient sous le même nom même si le moteur a nommé l'arrivée S04E16 (2)", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-episode-replacement-"));
  const config = path.join(sandbox, "config");
  const root = path.join(sandbox, "library");
  const folder = path.join(root, "Ma série", "Saison 4");
  await fsp.mkdir(config, { recursive: true });
  await fsp.mkdir(folder, { recursive: true });
  const oldFile = path.join(folder, "Ma série - S04E15.mkv");
  const plexView = "/volume1/docker/plex/series/Ma série/Saison 4/Ma série - S04E15.mkv";
  const neighbor = path.join(folder, "Ma série - S04E16.mkv");
  const incoming = path.join(folder, "Ma série - S04E16 (2).mkv");
  const newSize = Buffer.byteLength("version française");
  await fsp.writeFile(oldFile, "version japonaise");
  await fsp.writeFile(neighbor, "épisode 16 existant");
  await fsp.writeFile(incoming, "version française");
  await fsp.writeFile(path.join(config, "engine-state.json"), JSON.stringify({ instances: { series: { completedPath: root } } }));

  const previousConfig = process.env.MOVVIZ_CONFIG_DIR;
  const previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  globalThis.fetch = async () => Response.json({ instances: [{ completedPath: root }] });
  try {
    const [{ addSeries, getSeries }, { applyImportedFiles }, { resolveEpisodePlayback }, { flushPendingJsonWritesSync }] = await Promise.all([
      import("@/lib/library/store"),
      import("@/lib/library/applyImportedFiles"),
      import("@/lib/playback/sourceResolver"),
      import("@/lib/fsJsonCache"),
    ]);
    addSeries({
      id: "sr_replace_test", tmdbId: 123456789, imdbId: null, title: "Ma série", year: 2026,
      releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
      genres: [], tvStatus: "Returning Series", monitored: true, qualityProfileId: "default",
      seasons: [{ seasonNumber: 4, name: "Saison 4", monitored: true, episodes: [{
        seasonNumber: 4, episodeNumber: 15, title: "Épisode 15", airDate: null,
        monitored: true, status: "downloading", activeInfoHash: null,
        plexRatingKey: "old-plex-key", playbackSource: "plex",
        file: { path: plexView, quality: "1080p", resolution: "1080p", videoCodec: null,
          audioCodec: null, hdr: null, source: null, size: 18, addedAt: Date.now() },
      }] }],
      plexRatingKey: "show-plex-key", addedAt: Date.now(),
    } as Parameters<typeof addSeries>[0]);

    const result = await applyImportedFiles(
      { kind: "episode", seriesId: "sr_replace_test", season: 4, episode: 15 },
      [{ path: incoming, quality: "WEB-DL", resolution: "1080p", videoCodec: null,
        audioCodec: null, hdr: null, source: "WEB-DL", size: newSize, season: 4, episode: 16 }],
      "episode-15-new-release",
    );
    assert.equal(result.ok, true);
    assert.equal(await fsp.readFile(oldFile, "utf8"), "version française");
    assert.equal(await fsp.readFile(neighbor, "utf8"), "épisode 16 existant");
    await assert.rejects(fsp.access(incoming), { code: "ENOENT" });

    const episode = getSeries("sr_replace_test")!.seasons[0].episodes[0];
    assert.equal(episode.file?.path, oldFile);
    assert.equal(episode.playbackSource, "movviz");
    assert.equal(episode.lastImportedInfoHash, "episode-15-new-release");
    const playback = resolveEpisodePlayback("sr_replace_test", 4, 15);
    assert.equal(playback.ok, true);
    if (playback.ok) {
      assert.equal(playback.value.source, "movviz");
      assert.equal(playback.value.path, oldFile);
      assert.equal(await fsp.readFile(playback.value.path!, "utf8"), "version française");
    }
    const { alreadyAppliedEpisodeImport } = await import("@/lib/library/importRetry");
    const retry = { path: incoming, size: newSize, quality: null, resolution: null, videoCodec: null,
      audioCodec: null, hdr: null, source: null, season: 4, episode: 16 };
    assert.equal(await alreadyAppliedEpisodeImport("sr_replace_test", 4, 15, "episode-15-new-release", retry), true);
    assert.equal(await alreadyAppliedEpisodeImport("sr_replace_test", 4, 15, "un-autre-torrent", retry), false);

    // Si le basculement du nouveau fichier échoue, l'ancien et la nouvelle
    // arrivée doivent tous deux rester présents pour un prochain essai.
    const failedIncoming = path.join(folder, "Ma série - S04E16 (3).mkv");
    await fsp.writeFile(failedIncoming, "autre version française");
    const rename = fsp.rename;
    fsp.rename = async (from, to) => {
      if (String(from).includes(".movviz-pending-") && String(to) === oldFile) {
        throw Object.assign(new Error("basculement simulé impossible"), { code: "EACCES" });
      }
      return rename(from, to);
    };
    try {
      await assert.rejects(applyImportedFiles(
        { kind: "episode", seriesId: "sr_replace_test", season: 4, episode: 15 },
        [{ ...retry, path: failedIncoming, size: Buffer.byteLength("autre version française") }],
        "episode-15-third-release",
      ), /basculement simulé impossible/);
    } finally {
      fsp.rename = rename;
    }
    assert.equal(await fsp.readFile(oldFile, "utf8"), "version française");
    assert.equal(await fsp.readFile(failedIncoming, "utf8"), "autre version française");

    // Rejoue aussi la situation observée : S04E15 a déjà disparu. Un
    // retéléchargement doit recréer son nom sans conserver « (3) » à côté.
    await fsp.unlink(oldFile);
    const recovered = await applyImportedFiles(
      { kind: "episode", seriesId: "sr_replace_test", season: 4, episode: 15 },
      [{ ...retry, path: failedIncoming, size: Buffer.byteLength("autre version française") }],
      "episode-15-third-release",
    );
    assert.equal(recovered.ok, true);
    assert.equal(await fsp.readFile(oldFile, "utf8"), "autre version française");
    await assert.rejects(fsp.access(failedIncoming), { code: "ENOENT" });
    flushPendingJsonWritesSync();
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
    flushPendingJsonWritesSync();
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR;
    else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});
