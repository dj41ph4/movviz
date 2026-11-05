import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-incremental-"));
const { isPlaceholderEpisodeTitle } = await import("../src/lib/metadata/tmdb.ts");
const { mergeSeasons } = await import("../src/lib/library/episodeSync.ts");
const { isFresh, markDone, readState, writeState } = await import("../src/lib/library/taskMemory.ts");
const { episodeMayBeIncomplete } = await import("../src/lib/library/episodeMeta.ts");
const { movieIntervalMs, seriesIntervalMs } = await import("../src/lib/library/metadataRefresh.ts");
const store = await import("../src/lib/library/store.ts");
const { currentBenchmarkEnvironment } = await import("../src/lib/playback/engine/serverBenchmark.ts");
type Series = import("../src/lib/library/types.ts").LibrarySeries;
type Episode = import("../src/lib/library/types.ts").LibraryEpisode;

const DAY = 24 * 60 * 60 * 1000;
const episode = (n: number, over: Partial<Episode> = {}): Episode => ({
  seasonNumber: 1, episodeNumber: n, title: `Titre ${n}`, airDate: "2020-01-01", monitored: true, status: "missing",
  file: null, activeInfoHash: null, plexRatingKey: null, ...over,
});
const series = (over: Partial<Series> = {}): Series => ({
  id: "sr_inc", tmdbId: 4242, imdbId: null, title: "Série test", year: 2020, releaseDate: null, overview: "", posterPath: null, backdropPath: null,
  rating: 0, genres: [], tvStatus: "Returning Series", monitored: true, qualityProfileId: "any", addedAt: 1,
  seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [episode(1), episode(2)] }],
  ...over,
} as Series);
const tmdbSeason = (seasonNumber: number, episodes: { n: number; title: string; airDate?: string | null }[]) => ({
  seasonNumber, name: `S${seasonNumber}`, episodeCount: episodes.length, airDate: null, posterPath: null,
  episodes: episodes.map((e) => ({ seasonNumber, episodeNumber: e.n, title: e.title, airDate: e.airDate ?? "2020-01-01", overview: "", stillPath: null, runtime: null, rating: 0 })),
});

test("un titre vide ou « Épisode N » est un titre de remplacement, un vrai titre non", () => {
  for (const placeholder of ["", "  ", null, undefined, "Épisode 5", "Episode 12", "Folge 3", "Aflevering 7", "Puntata 2"]) assert.equal(isPlaceholderEpisodeTitle(placeholder), true, String(placeholder));
  for (const real of ["Le grand retour", "Episode One: Pilot", "Épisode final"]) assert.equal(isPlaceholderEpisodeTitle(real), false, real);
});

test("fusion partielle : une saison non relue n'invalide pas la fusion, et un nouvel épisode est ajouté", () => {
  const lib = series({ seasons: [
    { seasonNumber: 1, name: "S1", monitored: true, episodes: [episode(1), episode(2)] },
    { seasonNumber: 2, name: "S2", monitored: true, episodes: [episode(1, { seasonNumber: 2 })] },
  ] });
  const fresh = [tmdbSeason(1, [{ n: 1, title: "Titre 1" }, { n: 2, title: "Titre 2" }, { n: 3, title: "Nouveau", airDate: "2999-01-01" }])];
  assert.equal(mergeSeasons(lib, fresh), null, "complète : une saison de la bibliothèque absente de TMDb bloque");
  const partial = mergeSeasons(lib, fresh, { partial: true });
  assert.ok(partial && partial.changed);
  assert.equal(partial.added, 1);
  assert.equal(partial.seasons[0].episodes.length, 3);
  assert.equal(partial.seasons[1].episodes.length, 1, "la saison non relue reste intacte");
});

test("un épisode dont le titre vient d'apparaître est mis à jour, un épisode complet ne change pas", () => {
  const lib = series({ seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [episode(1, { title: "Épisode 1" }), episode(2)] }] });
  const merged = mergeSeasons(lib, [tmdbSeason(1, [{ n: 1, title: "Le vrai titre" }, { n: 2, title: "Titre 2" }])], { partial: true });
  assert.ok(merged && merged.changed);
  assert.equal(merged.seasons[0].episodes[0].title, "Le vrai titre");
  assert.equal(mergeSeasons(lib, [tmdbSeason(1, [{ n: 1, title: "Épisode 1" }, { n: 2, title: "Titre 2" }])], { partial: true })?.changed, false);
});

test("mémoire des tâches : fraîche seulement dans le délai et avec la même signature", () => {
  const now = 1_000_000_000_000;
  assert.equal(isFresh("t", "a", DAY, undefined, now), false, "jamais traité");
  markDone("t", "a", "sig1", 0, now);
  assert.equal(isFresh("t", "a", DAY, "sig1", now + DAY - 1), true);
  assert.equal(isFresh("t", "a", DAY, "sig1", now + DAY + 1), false, "délai dépassé");
  assert.equal(isFresh("t", "a", DAY, "sig2", now + 1), false, "signature changée : à refaire");
  writeState("etat", { n: 3 });
  assert.deepEqual(readState("etat", { n: 0 }), { n: 3 });
});

test("épisode à recharger : sans titre, sans date ou récent ; pas un ancien épisode complet", () => {
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * DAY).toISOString().slice(0, 10);
  assert.equal(episodeMayBeIncomplete(episode(1, { title: "Épisode 4", airDate: iso(400) }), now), true);
  assert.equal(episodeMayBeIncomplete(episode(1, { airDate: null }), now), true);
  assert.equal(episodeMayBeIncomplete(episode(1, { airDate: iso(3) }), now), true);
  assert.equal(episodeMayBeIncomplete(episode(1, { airDate: iso(400) }), now), false);
});

test("un épisode qui devient disponible est signalé, quelle que soit la voie (téléchargement, dossier, Plex)", async () => {
  const arrivals: { seriesId: string; episodes: { seasonNumber: number; episodeNumber: number }[] }[] = [];
  store.onEpisodeArrival((seriesId, episodes) => arrivals.push({ seriesId, episodes }));
  store.addSeries(series());
  const file = { path: "/lib/s01e02.mkv", size: 1, addedAt: Date.now() } as unknown as NonNullable<Episode["file"]>;
  const current = store.getSeries("sr_inc")!;
  // Rien ne change : aucun signalement.
  store.updateSeries("sr_inc", { seasons: current.seasons });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(arrivals.length, 0);
  store.updateSeries("sr_inc", { seasons: current.seasons.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.episodeNumber === 2 ? { ...e, status: "available" as const, file } : e)) })) });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(arrivals.length, 1);
  assert.deepEqual(arrivals[0].episodes, [{ seasonNumber: 1, episodeNumber: 2 }]);
});

test("fréquence de revérification d'une fiche selon son âge", () => {
  const now = Date.now();
  const movie = (releaseDate: string | null, addedDaysAgo = 400) => ({ releaseDate, vfReleaseDate: null, addedAt: now - addedDaysAgo * DAY }) as never;
  const iso = (days: number) => new Date(now - days * DAY).toISOString().slice(0, 10);
  assert.equal(movieIntervalMs(movie(iso(-30)), now), DAY, "à venir");
  assert.equal(movieIntervalMs(movie(null), now), DAY, "sans date");
  assert.equal(movieIntervalMs(movie(iso(30)), now), DAY, "sorti il y a un mois");
  assert.equal(movieIntervalMs(movie(iso(400)), now), 7 * DAY, "sorti il y a un an");
  assert.equal(movieIntervalMs(movie(iso(4000)), now), 30 * DAY, "vieux film");
  assert.equal(movieIntervalMs(movie(iso(4000), 3), now), DAY, "ajouté il y a 3 jours");
  assert.equal(seriesIntervalMs({ tvStatus: "Returning Series", addedAt: now - 500 * DAY } as never, now), DAY);
  assert.equal(seriesIntervalMs({ tvStatus: "Ended", addedAt: now - 500 * DAY } as never, now), 30 * DAY);
  assert.equal(seriesIntervalMs({ tvStatus: "Ended", addedAt: now - 2 * DAY } as never, now), DAY);
});

test("l'empreinte du banc d'essai est stable d'un appel à l'autre", () => {
  assert.equal(typeof currentBenchmarkEnvironment(), "string");
  assert.equal(currentBenchmarkEnvironment(), currentBenchmarkEnvironment());
});
