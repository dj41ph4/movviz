import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Régression Batman (série animée) : une intégrale choisie à la main doit REMPLACER les fichiers
// déjà présents sur le NAS (ici de la mauvaise série), sans laisser de « (2) » à côté.
test("une intégrale importée remplace chaque épisode existant, dans toutes les saisons, sans doublon « (2) »", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-integral-replace-"));
  const config = path.join(sandbox, "config");
  const root = path.join(sandbox, "library");
  const s1 = path.join(root, "Ma série", "Saison 1");
  const s2 = path.join(root, "Ma série", "Saison 2");
  await fsp.mkdir(config, { recursive: true });
  await fsp.mkdir(s1, { recursive: true });
  await fsp.mkdir(s2, { recursive: true });
  const old = {
    "1x1": path.join(s1, "Ma série - S01E01.mkv"), "1x2": path.join(s1, "Ma série - S01E02.mkv"),
    "2x1": path.join(s2, "Ma série - S02E01.mkv"),
  };
  const incoming = {
    "1x1": path.join(s1, "Ma série - S01E01 (2).mkv"), "1x2": path.join(s1, "Ma série - S01E02 (2).mkv"),
    "2x1": path.join(s2, "Ma série - S02E01 (2).mkv"),
  };
  for (const key of Object.keys(old) as (keyof typeof old)[]) {
    await fsp.writeFile(old[key], "mauvaise série");
    await fsp.writeFile(incoming[key], `bon épisode ${key}`);
  }
  await fsp.writeFile(path.join(config, "engine-state.json"), JSON.stringify({ instances: { series: { completedPath: root } } }));

  const previousConfig = process.env.MOVVIZ_CONFIG_DIR;
  const previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  globalThis.fetch = async () => Response.json({ instances: [{ completedPath: root }] });
  try {
    const [{ addSeries, getSeries }, { applyImportedFiles }] = await Promise.all([
      import("@/lib/library/store"),
      import("@/lib/library/applyImportedFiles"),
    ]);
    const episode = (seasonNumber: number, episodeNumber: number, file: string) => ({
      seasonNumber, episodeNumber, title: `Épisode ${episodeNumber}`, airDate: null, monitored: true,
      status: "available" as const, activeInfoHash: null, playbackSource: "movviz" as const,
      file: { path: file, quality: "1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size: 14, addedAt: 1 },
    });
    addSeries({
      id: "sr_integral_replace", tmdbId: 987654321, imdbId: null, title: "Ma série", year: 1992,
      releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
      genres: [], tvStatus: "Ended", monitored: true, qualityProfileId: "default",
      seasons: [
        { seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [episode(1, 1, old["1x1"]), episode(1, 2, old["1x2"])] },
        { seasonNumber: 2, name: "Saison 2", monitored: true, episodes: [episode(2, 1, old["2x1"])] },
      ],
      plexRatingKey: null, addedAt: Date.now(),
    } as unknown as Parameters<typeof addSeries>[0]);

    const files = (Object.keys(incoming) as (keyof typeof incoming)[]).map((key) => ({
      path: incoming[key], quality: "BluRay", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "BluRay",
      size: Buffer.byteLength(`bon épisode ${key}`), season: Number(key[0]), episode: Number(key[2]),
    }));
    const result = await applyImportedFiles({ kind: "series", seriesId: "sr_integral_replace" }, files, "integrale-109ep");
    assert.equal(result.ok, true);

    for (const key of Object.keys(old) as (keyof typeof old)[]) {
      assert.equal(await fsp.readFile(old[key], "utf8"), `bon épisode ${key}`, `${key} doit contenir le nouveau fichier sous son nom final`);
      await assert.rejects(fsp.access(incoming[key]), { code: "ENOENT" });
    }
    assert.deepEqual((await fsp.readdir(s1)).sort(), ["Ma série - S01E01.mkv", "Ma série - S01E02.mkv"]);
    assert.deepEqual(await fsp.readdir(s2), ["Ma série - S02E01.mkv"]);
    const series = getSeries("sr_integral_replace")!;
    for (const season of series.seasons) for (const ep of season.episodes) {
      assert.equal(ep.lastImportedInfoHash, "integrale-109ep");
      assert.equal(ep.status, "available");
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true }).catch(() => {});
  }
});
