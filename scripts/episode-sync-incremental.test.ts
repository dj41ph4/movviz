import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-episode-sync-"));
process.env.MOVVIZ_TMDB_API_KEY = "test-key";
const store = await import("../src/lib/library/store.ts");
const { syncSeriesEpisodes } = await import("../src/lib/library/episodeSync.ts");
const { refreshSeasonsMeta } = await import("../src/lib/library/episodeMeta.ts");
const { markDone } = await import("../src/lib/library/taskMemory.ts");
type Episode = import("../src/lib/library/types.ts").LibraryEpisode;

const DAY = 24 * 60 * 60 * 1000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

/** Faux TMDb : séries { id → { status, saisons: { numéro → épisodes par langue } } }, et journal des appels. */
interface FakeEpisode { n: number; name: string; overview?: string; air: string }
const fake: Record<number, { status: string; seasons: Record<number, { fr: FakeEpisode[]; en?: FakeEpisode[] }> }> = {};
const calls: string[] = [];
globalThis.fetch = (async (input: unknown) => {
  const url = new URL(String(input));
  if (!url.hostname.includes("themoviedb")) throw new Error("appel réseau inattendu : " + url);
  const seasonMatch = url.pathname.match(/\/tv\/(\d+)\/season\/(\d+)$/);
  const seriesMatch = url.pathname.match(/\/tv\/(\d+)$/);
  const lang = url.searchParams.get("language") === "en-US" ? "en" : "fr";
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (seasonMatch) {
    const [, id, season] = seasonMatch;
    calls.push(`season:${id}:${season}:${lang}`);
    const season0 = fake[Number(id)]?.seasons[Number(season)];
    if (!season0) return new Response("{}", { status: 404 });
    const list = lang === "en" ? season0.en ?? season0.fr : season0.fr;
    return json({ name: `Saison ${season}`, air_date: null, poster_path: null, episodes: list.map((e) => ({ season_number: Number(season), episode_number: e.n, name: e.name, overview: e.overview ?? "", air_date: e.air, still_path: null, runtime: null, vote_average: 0 })) });
  }
  if (seriesMatch) {
    const [, id] = seriesMatch;
    calls.push(`series:${id}`);
    const s = fake[Number(id)];
    if (!s) return new Response("{}", { status: 404 });
    return json({ id: Number(id), name: `Série ${id}`, status: s.status, genres: [], origin_country: [], first_air_date: "2020-01-01", external_ids: {}, seasons: Object.entries(s.seasons).map(([n, v]) => ({ season_number: Number(n), name: `Saison ${n}`, episode_count: v.fr.length, air_date: null, poster_path: null })) });
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

const ep = (n: number, over: Partial<Episode> = {}): Episode => ({
  seasonNumber: 1, episodeNumber: n, title: `Titre ${n}`, airDate: iso(-400), monitored: true, status: "available",
  file: null, activeInfoHash: null, plexRatingKey: null, ...over,
});
function addLibrarySeries(id: string, tmdbId: number, tvStatus: string, episodes: Episode[]) {
  store.addSeries({
    id, tmdbId, imdbId: null, title: `Série ${tmdbId}`, year: 2020, releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
    genres: [], tvStatus, monitored: true, qualityProfileId: "any", addedAt: 1,
    seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes }],
  } as never);
}
const titles = (id: string) => store.getSeries(id)!.seasons.flatMap((s) => s.episodes.map((e) => `${s.seasonNumber}x${e.episodeNumber}:${e.title}`));
const callsFor = (tmdbId: number) => calls.filter((c) => c.split(":")[1] === String(tmdbId));

test("première passe : vérification complète ; nouvel épisode, nouvelle saison et titre manquant sont détectés", async () => {
  fake[101] = { status: "Returning Series", seasons: {
    1: { fr: [{ n: 1, name: "Un", air: iso(-400) }, { n: 2, name: "Deux", air: iso(-390) }, { n: 3, name: "Trois", air: iso(-380) }] },
    2: { fr: [{ n: 1, name: "Nouvelle saison", air: iso(5) }] },
  } };
  addLibrarySeries("sr_a", 101, "Returning Series", [ep(1, { title: "Un" }), ep(2, { title: "Épisode 2" })]);
  await syncSeriesEpisodes();
  assert.deepEqual(titles("sr_a"), ["1x1:Un", "1x2:Deux", "1x3:Trois", "2x1:Nouvelle saison"]);
});

test("passe suivante : une série en cours, complète et sans rien d'en attente ne recharge aucune saison", async () => {
  fake[102] = { status: "Returning Series", seasons: { 1: { fr: [{ n: 1, name: "Un", air: iso(-400) }, { n: 2, name: "Deux", air: iso(-390) }] } } };
  addLibrarySeries("sr_b", 102, "Returning Series", [ep(1, { title: "Un" }), ep(2, { title: "Deux" })]);
  markDone("series-episodes-sync", "sr_b:deep", undefined, 0); // vérification complète récente
  calls.length = 0;
  await syncSeriesEpisodes();
  assert.deepEqual(callsFor(102), ["series:102"], "la fiche série seulement, aucune saison");
});

test("un nouvel épisode d'une série en cours est détecté dès la passe suivante (nombre d'épisodes différent)", async () => {
  fake[103] = { status: "Returning Series", seasons: { 1: { fr: [{ n: 1, name: "Un", air: iso(-400) }, { n: 2, name: "Deux", air: iso(-2) }] } } };
  addLibrarySeries("sr_c", 103, "Returning Series", [ep(1, { title: "Un" })]);
  markDone("series-episodes-sync", "sr_c:deep", undefined, 0);
  await syncSeriesEpisodes();
  assert.deepEqual(titles("sr_c"), ["1x1:Un", "1x2:Deux"]);
});

test("série terminée et complète déjà vérifiée récemment : aucun appel TMDb ; sinon elle est revérifiée", async () => {
  fake[104] = { status: "Ended", seasons: { 1: { fr: [{ n: 1, name: "Un", air: iso(-900) }] } } };
  addLibrarySeries("sr_d", 104, "Ended", [ep(1, { title: "Un", airDate: iso(-900) })]);
  markDone("series-episodes-sync", "sr_d", undefined, 0);
  markDone("series-episodes-sync", "sr_d:deep", undefined, 0);
  calls.length = 0;
  await syncSeriesEpisodes();
  assert.deepEqual(callsFor(104), []);
  markDone("series-episodes-sync", "sr_d", undefined, 0, Date.now() - 4 * DAY);
  await syncSeriesEpisodes();
  assert.deepEqual(callsFor(104), ["series:104"], "revérifiée après 3 jours, sans recharger les saisons complètes");
});

test("un épisode sans titre est rechargé à la passe suivante sans attendre la vérification complète", async () => {
  fake[105] = { status: "Returning Series", seasons: { 1: { fr: [{ n: 1, name: "Un", air: iso(-400) }, { n: 2, name: "Le vrai titre", air: iso(-1) }] } } };
  addLibrarySeries("sr_e", 105, "Returning Series", [ep(1, { title: "Un" }), ep(2, { title: "Épisode 2", airDate: iso(-1) })]);
  markDone("series-episodes-sync", "sr_e:deep", undefined, 0);
  await syncSeriesEpisodes();
  assert.deepEqual(titles("sr_e"), ["1x1:Un", "1x2:Le vrai titre"]);
});

test("rechargement ciblé : titre manquant en français → titre anglais, puis le titre français quand TMDb l'a", async () => {
  fake[106] = { status: "Returning Series", seasons: { 1: {
    fr: [{ n: 1, name: "Un", air: iso(-400) }, { n: 2, name: "Épisode 2", overview: "", air: iso(-1) }],
    en: [{ n: 1, name: "One", air: iso(-400) }, { n: 2, name: "The Real Title", overview: "English synopsis", air: iso(-1) }],
  } } };
  addLibrarySeries("sr_f", 106, "Returning Series", [ep(1, { title: "Un" }), ep(2, { title: "Épisode 2", airDate: iso(-1) })]);
  const result = await refreshSeasonsMeta("sr_f", [1]);
  assert.equal(result.updated, true);
  assert.deepEqual(titles("sr_f"), ["1x1:Un", "1x2:The Real Title"]);
  // La traduction française arrive : le titre français remplace l'anglais (saison rechargée à neuf).
  fake[106].seasons[1].fr[1] = { n: 2, name: "Le Vrai Titre", overview: "Synopsis français", air: iso(-1) };
  const later = await import("../src/lib/library/episodeMeta.ts");
  // Le délai minimal entre deux rechargements à neuf de la même saison est contourné en vidant l'historique.
  (globalThis as { __movvizEpisodeMeta?: { lastFresh: Map<string, number> } }).__movvizEpisodeMeta?.lastFresh.clear();
  await later.refreshSeasonsMeta("sr_f", [1]);
  assert.deepEqual(titles("sr_f"), ["1x1:Un", "1x2:Le Vrai Titre"]);
});
