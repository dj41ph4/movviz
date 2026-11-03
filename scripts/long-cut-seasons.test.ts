import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { longCutEpisodeCount, shrinkToLongCut, toLongCutSeason } from "../src/lib/metadata/longCutSeasons.ts";
import { seriesLibraryStatus } from "../src/lib/library/seriesLibraryStatus.ts";
import type { LibraryEpisode } from "../src/lib/library/types.ts";
import type { MetaSeason } from "../src/lib/metadata/types.ts";

const KAAMELOTT = 11466;

const broadcast = (): MetaSeason => ({
  seasonNumber: 5, name: "Livre V", episodeCount: 50, airDate: "2007-05-01", posterPath: null,
  episodes: Array.from({ length: 50 }, (_, index) => ({
    seasonNumber: 5, episodeNumber: index + 1, title: `Scène ${index + 1}`, airDate: `date-${index + 1}`,
    overview: `Résumé ${index + 1}.`, stillPath: `/still-${index + 1}.jpg`, runtime: 7, rating: index === 0 ? 0 : 6,
  })),
});

const libraryEpisodes = (count = 50): LibraryEpisode[] => Array.from({ length: count }, (_, index) => ({
  seasonNumber: 5, episodeNumber: index + 1, title: `Scène ${index + 1}`, airDate: "2007-05-01",
  monitored: true, status: "missing" as const, activeInfoHash: null, plexRatingKey: null, file: null,
}));

test("le Livre V compte 8 épisodes longs, avec les titres et les résumés de leurs scènes", () => {
  const season = toLongCutSeason(KAAMELOTT, broadcast());
  assert.equal(season.episodeCount, 8);
  assert.deepEqual(season.episodes.map((episode) => episode.episodeNumber), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(season.episodes.map((episode) => episode.title), [
    "Corvus Corone", "La Roche et le Fer", "Væ Soli !", "Le Dernier Jour",
    "Le Royaume sans tête", "Jizô", "Le Phare", "Le Garçon qui criait au loup",
  ]);
  assert.equal(season.episodes[1].overview, "Résumé 7. Résumé 8. Résumé 9. Résumé 10. Résumé 11. Résumé 12.");
  assert.ok(season.episodes[7].overview.endsWith("Résumé 50."), "la dernière scène n'est pas perdue");
  assert.equal(season.episodes[1].airDate, "date-7");
  assert.equal(season.episodes[1].stillPath, "/still-7.jpg");
  assert.equal(season.episodes[1].runtime, 50);
  assert.equal(season.episodes[0].rating, 6, "une scène sans vote ne baisse pas la note");
});

test("les autres saisons et séries gardent leur catalogue", () => {
  const season = broadcast();
  assert.equal(toLongCutSeason(1, season), season);
  const season4 = { ...season, seasonNumber: 4 };
  assert.equal(toLongCutSeason(KAAMELOTT, season4), season4);
  assert.equal(longCutEpisodeCount(KAAMELOTT, 4), null);
  assert.equal(longCutEpisodeCount(KAAMELOTT, 5), 8);
});

test("une saison vide passe à 8 ; des épisodes courts présents sur le disque ne sont jamais retirés", () => {
  const shrunk = shrinkToLongCut(KAAMELOTT, 5, libraryEpisodes());
  assert.equal(shrunk.length, 8);
  assert.equal(shrunk[5].title, "Jizô");
  assert.equal(shrinkToLongCut(KAAMELOTT, 5, shrunk), shrunk, "déjà à 8 : rien à réécrire");

  const withFile = libraryEpisodes();
  withFile[20] = { ...withFile[20], status: "available", file: { path: "/x/S05E21.mkv" } as never };
  assert.equal(shrinkToLongCut(KAAMELOTT, 5, withFile), withFile);
  const otherSeries = libraryEpisodes();
  assert.equal(shrinkToLongCut(1, 5, otherSeries), otherSeries);
});

test("un téléchargement en cours passe sur les 8 épisodes, même si les premiers n'étaient plus suivis", () => {
  // État réel relevé en prod : 27 scènes réclamées par le pack, les autres retirées du suivi.
  const episodes = libraryEpisodes().map((episode) => episode.episodeNumber >= 12
    ? { ...episode, status: "downloading" as const, activeInfoHash: "6fa0d7cc" }
    : { ...episode, monitored: false });
  const shrunk = shrinkToLongCut(KAAMELOTT, 5, episodes);
  assert.equal(shrunk.length, 8);
  assert.equal(shrunk.every((episode) => episode.monitored && episode.status === "downloading" && episode.activeInfoHash === "6fa0d7cc"), true);
});

test("le moteur reconnaît les 8 fichiers du pack, et rien d'autre", async () => {
  const { kaamelottLongEpisode } = await import("../engine/src/kaamelottLongCut.mjs");
  const names = [
    "S05E01E02E03E04E05E06", "S05E07E08E09E10E11E12", "S05E13E14E15E16E17E18", "S05E19E20E21E22E23E24E25",
    "S05E26E27E28E29E30E31E32", "S05E33E34E35E36E37E38", "S05E39E40E41E42E43", "S05E44E45E46E47E48E49E50",
  ];
  assert.deepEqual(names.map((name) => kaamelottLongEpisode(`Kaamelott.${name}.FRENCH.1080p.BluRay.x264.AC3-Dam.mkv`)), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const other of [
    "Autre.Serie.S05E01E02E03E04E05E06.1080p.mkv",
    "Kaamelott.S04E01E02E03E04E05E06.1080p.mkv",
    "Kaamelott.S05E01E02.1080p.mkv",
    "Kaamelott.S05E03.1080p.mkv",
    "Kaamelott - S05E02.mkv",
  ]) assert.equal(kaamelottLongEpisode(other), null, other);
});

test("une bibliothèque à 50 passe à 8 au démarrage, et le pack des 8 fichiers la rend complète", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-long-cut-"));
  const config = path.join(sandbox, "config");
  const root = path.join(sandbox, "library");
  const folder = path.join(root, "Kaamelott", "Saison 5");
  await fsp.mkdir(config, { recursive: true });
  await fsp.mkdir(folder, { recursive: true });
  await fsp.writeFile(path.join(config, "engine-state.json"), JSON.stringify({ instances: { series: { completedPath: root } } }));
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR;
  const previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  globalThis.fetch = async () => Response.json({ instances: [{ completedPath: root }] });
  try {
    const [{ addSeries, getSeries }, { applyImportedFiles }, { repairLongCutSeasons, mergeSeasons }, { flushPendingJsonWritesSync }] = await Promise.all([
      import("@/lib/library/store"),
      import("@/lib/library/applyImportedFiles"),
      import("@/lib/library/episodeSync"),
      import("@/lib/fsJsonCache"),
    ]);
    addSeries({
      id: "sr_kaamelott_test", tmdbId: KAAMELOTT, imdbId: null, title: "Kaamelott", year: 2005,
      releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
      genres: [], tvStatus: "Ended", monitored: true, qualityProfileId: "default",
      seasons: [{ seasonNumber: 5, name: "Livre V", monitored: true, episodes: libraryEpisodes() }],
      plexRatingKey: null, addedAt: Date.now(),
    } as Parameters<typeof addSeries>[0]);
    const episodes = () => getSeries("sr_kaamelott_test")!.seasons[0].episodes;

    assert.equal(await repairLongCutSeasons(), 1);
    assert.equal(episodes().length, 8);
    assert.equal(seriesLibraryStatus(getSeries("sr_kaamelott_test")!), "missing");
    assert.equal(await repairLongCutSeasons(), 0, "le démarrage suivant ne réécrit rien");

    const pack = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const filePath = path.join(folder, `Kaamelott - S05E0${index + 1}.mkv`);
      await fsp.writeFile(filePath, "long");
      return { path: filePath, quality: "BluRay 1080p", resolution: "1080p", videoCodec: "x264", audioCodec: "AC3", hdr: null, source: "BluRay", size: 4, season: 5, episode: index + 1 };
    }));
    assert.equal((await applyImportedFiles({ kind: "season", seriesId: "sr_kaamelott_test", season: 5 }, pack, "pack")).ok, true);
    assert.equal(episodes().filter((episode) => episode.status === "available").length, 8);
    assert.equal(new Set(episodes().map((episode) => episode.file?.path)).size, 8, "chaque épisode a son propre fichier");
    assert.equal(seriesLibraryStatus(getSeries("sr_kaamelott_test")!), "available");

    // La synchronisation quotidienne ne remet ni scènes ni épisodes manquants.
    const merged = mergeSeasons(getSeries("sr_kaamelott_test")!, [toLongCutSeason(KAAMELOTT, broadcast())]);
    assert.ok(merged);
    assert.equal(merged.added, 0);
    assert.equal(merged.seasons[0].episodes.length, 8);
    assert.equal(merged.seasons[0].episodes.every((episode) => episode.status === "available"), true);
    flushPendingJsonWritesSync();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig == null) delete process.env.MOVVIZ_CONFIG_DIR;
    else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true }).catch(() => {});
  }
});
