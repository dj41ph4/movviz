import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Whole resync, real files, fake TMDb + TVDB, and NO Plex configured at all.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-e2e-cfg-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
process.env.MOVVIZ_TVDB_API_KEY = "test-key";
process.env.MOVVIZ_TMDB_API_KEY = "test-key";

const TMDB_ID = 990001;
const TVDB_ID = 880001;
const day = (n: number) => new Date(Date.UTC(2015, 6, 5) + n * 7 * 86_400_000).toISOString().slice(0, 10);
// TMDb: one flat season of 6. TVDB: two arcs of 3, same broadcasts.
const tmdbEpisodes = Array.from({ length: 6 }, (_, i) => ({ season_number: 1, episode_number: i + 1, name: `Épisode TMDb ${i + 1}`, air_date: day(i), overview: "x" }));
const tvdbEpisodes = Array.from({ length: 6 }, (_, i) => ({ seasonNumber: i < 3 ? 1 : 2, number: (i % 3) + 1, name: `Titre TVDB ${i + 1}`, aired: day(i) }));
let tvdbDown = false;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  // Two more shows for the library-wide pass: 4 episodes, TMDb flat, TVDB 2 + 2.
  const extra = [990002, 990003].find((id) => url.pathname.startsWith(`/3/tv/${id}`));
  const extraTvdb = [880002, 880003].find((id) => url.pathname.includes(`/series/${id}`));
  if (extra) {
    const eps = Array.from({ length: 4 }, (_, i) => ({ season_number: 1, episode_number: i + 1, name: `Old ${i + 1}`, air_date: day(100 + i), overview: "x" }));
    if (url.pathname.endsWith("/season/1")) return json({ name: "Saison 1", episodes: eps });
    return json({ id: extra, name: "Old", first_air_date: day(100), genres: [{ id: 16, name: "Animation" }], origin_country: ["JP"], external_ids: { tvdb_id: extra - 110000 }, seasons: [{ season_number: 1, name: "Saison 1", episode_count: 4, air_date: day(100) }] });
  }
  if (extraTvdb && !tvdbDown) {
    if (url.pathname.includes("/episodes/default")) return json({ data: { episodes: Array.from({ length: 4 }, (_, i) => ({ seasonNumber: i < 2 ? 1 : 2, number: (i % 2) + 1, name: `Arc ${i + 1}`, aired: day(100 + i) })) }, links: { next: null } });
    if (url.pathname.endsWith("/extended")) return json({ data: { seasons: [] } });
  }
  if (url.hostname === "api.themoviedb.org") {
    if (url.pathname === `/3/tv/${TMDB_ID}`) return json({ id: TMDB_ID, name: "Arc Show", first_air_date: "2015-07-05", genres: [{ id: 16, name: "Animation" }], origin_country: ["JP"], external_ids: { tvdb_id: TVDB_ID }, seasons: [{ season_number: 1, name: "Saison 1", episode_count: 6, air_date: day(0) }] });
    if (url.pathname === `/3/tv/${TMDB_ID}/season/1`) return json({ name: "Saison 1", air_date: day(0), episodes: tmdbEpisodes });
    return json({}, 404);
  }
  if (url.hostname === "api4.thetvdb.com") {
    if (tvdbDown) return json({}, 503);
    if (url.pathname === "/v4/login") return json({ data: { token: "t" } });
    if (url.pathname.startsWith(`/v4/series/${TVDB_ID}/episodes/default`)) return json({ data: { episodes: tvdbEpisodes }, links: { next: null } });
    if (url.pathname === `/v4/series/${TVDB_ID}/extended`) return json({ data: { seasons: [{ id: 1, number: 1, name: "Arc 1", type: { type: "official" } }, { id: 2, number: 2, name: "Arc 2", type: { type: "official" } }] } });
    if (url.pathname.startsWith("/v4/seasons/")) return json({ data: { name: url.pathname.includes("/1/") ? "Arc Un" : "Arc Deux" } });
    return json({}, 404);
  }
  // Anything else — Plex included — is unreachable in this test.
  throw new Error(`offline: ${url.href}`);
}) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; });

const { addSeries, getSeries } = await import("../src/lib/library/store.ts");
const { setTrashConfig } = await import("../src/lib/library/trashStore.ts");
const { resyncAnimeSeasonsFromTvdb } = await import("../src/lib/library/autoGrabSeries.ts");

const media = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-e2e-media-"));
const root = path.join(media, "Arc Show");
const file = (s: number, e: number) => path.join(root, `Saison ${s}`, `Arc Show - S0${s}E0${e}.mkv`);
const trash = path.join(media, ".trash");
setTrashConfig({ seriesPath: trash });

function write(p: string, content: string) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
// Disk: the flat TMDb grab (S01E01–06) plus a later TVDB grab of arc 2's first episode.
for (let e = 1; e <= 6; e++) write(file(1, e), `ep${e}`);
write(file(2, 1), "ep4-again");

const ep = (s: number, e: number, p: string | null, extra = {}) => ({
  seasonNumber: s, episodeNumber: e, title: `Mon titre ${s}x${e}`, airDate: s === 1 ? day(e - 1) : day(e + 2), monitored: e !== 6,
  status: p ? "available" as const : "missing" as const,
  file: p ? { path: p, quality: "WEB 1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: fs.statSync(p).size, addedAt: 7 } : null,
  activeInfoHash: null, plexRatingKey: p ? `plex-${s}-${e}` : null, ...extra,
});
addSeries({
  id: "sr_e2e", tmdbId: TMDB_ID, imdbId: null, title: "Arc Show", year: 2015, releaseDate: "2015-07-05", overview: "", posterPath: null, backdropPath: null,
  rating: 0, genres: ["Animation"], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null,
  seasons: [
    { seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [1, 2, 3, 4, 5, 6].map((e) => ep(1, e, file(1, e))) },
    { seasonNumber: 2, name: "Saison 2", monitored: true, episodes: [ep(2, 1, file(2, 1))] },
  ],
} as never);

test("full resync without Plex: one structure, duplicate trashed, moved files renamed, order recorded for later", async () => {
  const result = await resyncAnimeSeasonsFromTvdb("sr_e2e");
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.source, "tvdb");
  assert.equal(result.duplicatesRemoved, 1);
  assert.equal(result.renamedFiles, 2);
  const s = getSeries("sr_e2e")!;
  assert.deepEqual(s.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:3", "2:3"]);
  assert.equal(s.episodeOrder, "tvdb");
  assert.equal(s.plexOrderPending, "tvdb");
  const s2 = s.seasons[1].episodes;
  // S2E1 keeps the copy already named S02E01 — the TMDb-named duplicate went to the trash.
  assert.equal(fs.readFileSync(s2[0].file!.path, "utf8"), "ep4-again");
  assert.ok(!fs.existsSync(file(1, 4)));
  assert.ok(fs.readdirSync(trash, { recursive: true }).map(String).some((n) => n.endsWith("S01E04.mkv")));
  // The two others were renamed after their TVDB number, in the existing Saison 2 folder.
  assert.equal(fs.readFileSync(s2[1].file!.path, "utf8"), "ep5");
  assert.match(path.basename(s2[1].file!.path), /S02E02/);
  assert.equal(path.basename(path.dirname(s2[2].file!.path)), "Saison 2");
  assert.equal(fs.readFileSync(s2[2].file!.path, "utf8"), "ep6");
  // Nothing of the episode travelled away: Plex key, monitoring, title, file record.
  assert.equal(s2[1].plexRatingKey, "plex-1-5");
  assert.equal(s2[2].monitored, false);
  assert.equal(s2[1].title, "Mon titre 1x5");
  assert.equal(s2[1].file!.addedAt, 7);
  assert.equal(s.seasons[1].name, "Arc Deux");
  assert.ok(fs.existsSync(path.join(config, "repair-snapshots", result.snapshot!)));
});

test("running it again changes nothing and writes no snapshot", async () => {
  const before = fs.readdirSync(path.join(config, "repair-snapshots")).length;
  const result = await resyncAnimeSeasonsFromTvdb("sr_e2e");
  assert.equal(result.ok && result.unchanged, true, JSON.stringify(result));
  assert.equal(fs.readdirSync(path.join(config, "repair-snapshots")).length, before);
});

test("TVDB unreachable: the TVDB structure is left exactly as it is", async () => {
  tvdbDown = true;
  const before = JSON.stringify(getSeries("sr_e2e"));
  const result = await resyncAnimeSeasonsFromTvdb("sr_e2e");
  tvdbDown = false;
  assert.deepEqual(result, { ok: false, error: "tvdb_unavailable" });
  assert.equal(JSON.stringify(getSeries("sr_e2e")), before);
});

test("daily episode sync: a new TVDB episode is added, TMDb's flat season never comes back", async () => {
  tmdbEpisodes.push({ season_number: 1, episode_number: 7, name: "Épisode TMDb 7", air_date: day(6), overview: "x" });
  tvdbEpisodes.push({ seasonNumber: 2, number: 4, name: "Titre TVDB 7", aired: day(6) });
  const { getCache } = await import("../src/lib/cache/registry.ts");
  getCache("The Movie Database API", 1).clear?.();
  getCache("The TVDB API", 1).clear?.();
  const { syncSeriesEpisodes } = await import("../src/lib/library/episodeSync.ts");
  await syncSeriesEpisodes();
  const s = getSeries("sr_e2e")!;
  assert.deepEqual(s.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:3", "2:4"]);
  assert.equal(s.seasons[1].episodes[3].title, "Titre TVDB 7");
  assert.equal(s.seasons[1].episodes[3].status, "missing");
});

test("daily pass on a TVDB series: TVDB moves an episode → file moved + renamed + Plex order asked, no click needed", async () => {
  // TVDB editors move the last arc-1 episode into arc 2 (3/4 → 2/5).
  tvdbEpisodes.splice(0, tvdbEpisodes.length, ...Array.from({ length: 7 }, (_, i) => ({ seasonNumber: i < 2 ? 1 : 2, number: i < 2 ? i + 1 : i - 1, name: `Titre TVDB ${i + 1}`, aired: day(i) })));
  const { getCache } = await import("../src/lib/cache/registry.ts");
  getCache("The TVDB API", 1).clear?.();
  const { updateSeries } = await import("../src/lib/library/store.ts");
  updateSeries("sr_e2e", { plexOrderPending: undefined, tvStatus: "Returning Series" });
  const { syncSeriesEpisodes } = await import("../src/lib/library/episodeSync.ts");
  await syncSeriesEpisodes();
  const s = getSeries("sr_e2e")!;
  assert.deepEqual(s.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:2", "2:5"]);
  const moved = s.seasons[1].episodes[0];
  assert.equal(fs.readFileSync(moved.file!.path, "utf8"), "ep3");
  assert.match(path.basename(moved.file!.path), /S02E01/);
  assert.equal(path.basename(path.dirname(moved.file!.path)), "Saison 2");
  assert.equal(s.plexOrderPending, "tvdb");
  // Every arc-2 file now carries its own number; nothing was overwritten.
  const contents = s.seasons[1].episodes.filter((e) => e.file).map((e) => fs.readFileSync(e.file!.path, "utf8"));
  assert.deepEqual(contents, ["ep3", "ep4-again", "ep5", "ep6"]);
  for (const e of s.seasons[1].episodes.filter((x) => x.file)) assert.match(path.basename(e.file!.path), new RegExp(`S02E0${e.episodeNumber}`));
});

test("library-wide alignment (scheduled task) without Plex: older anime put in TVDB, renamed, marked; a show with duplicates waits", async () => {
  const { alignAnimeLibraryOnTvdb } = await import("../src/lib/library/animeTvdbAlign.ts");
  const make = (id: string, tmdbId: number, title: string, withDuplicate: boolean) => {
    const dir = path.join(media, title);
    const f = (s: number, e: number) => path.join(dir, `Saison ${s}`, `${title} - S0${s}E0${e}.mkv`);
    for (let e = 1; e <= 4; e++) write(f(1, e), `${title}${e}`);
    const episodes = [1, 2, 3, 4].map((e) => ({ ...ep(1, e, f(1, e)), airDate: day(99 + e) }));
    const seasons = [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes }];
    if (withDuplicate) { write(f(2, 1), "copy"); seasons.push({ seasonNumber: 2, name: "Saison 2", monitored: true, episodes: [{ ...ep(2, 1, f(2, 1)), airDate: day(102) }] }); }
    addSeries({ id, tmdbId, imdbId: null, title, year: 2017, releaseDate: day(100), overview: "", posterPath: null, backdropPath: null, rating: 0, genres: ["Animation"], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: "show", seasons } as never);
    return f;
  };
  make("sr_old", 990002, "Old Show", false);
  const fd = make("sr_dup", 990003, "Dup Show", true);
  const summary = await alignAnimeLibraryOnTvdb({ background: true });
  assert.equal(summary.plexOrdersApplied, 0, "no Plex configured: nothing applied, nothing thrown");
  assert.deepEqual(summary.needsReview, ["Dup Show"]);
  const old = getSeries("sr_old")!;
  assert.deepEqual(old.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:2", "2:2"]);
  assert.equal(old.episodeOrder, "tvdb");
  assert.equal(old.plexOrderPending, "tvdb");
  assert.match(path.basename(old.seasons[1].episodes[0].file!.path), /S02E01/);
  assert.equal(path.basename(path.dirname(old.seasons[1].episodes[0].file!.path)), "Saison 2", "new season folder named like its siblings");
  assert.equal(fs.readFileSync(old.seasons[1].episodes[1].file!.path, "utf8"), "Old Show4");
  // The duplicate show is untouched, both copies still on disk, for its button.
  const dup = getSeries("sr_dup")!;
  assert.equal(dup.episodeOrder, undefined);
  assert.ok(fs.existsSync(fd(1, 3)) && fs.existsSync(fd(2, 1)));
});
