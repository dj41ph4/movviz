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
const tmdbEpisodes: Array<Record<string, unknown>> = Array.from({ length: 6 }, (_, i) => ({ season_number: 1, episode_number: i + 1, name: `Épisode TMDb ${i + 1}`, air_date: day(i), overview: `Résumé TMDb ${i + 1}`, still_path: `/still${i + 1}.jpg` }));
const tvdbEpisodes = Array.from({ length: 6 }, (_, i) => ({ seasonNumber: i < 3 ? 1 : 2, number: (i % 3) + 1, name: `Titre TVDB ${i + 1}`, aired: day(i) }));
let tvdbDown = false;
// The download engine, off by default (unreachable, like every other host here).
let engineTorrents: Array<Record<string, unknown>> | null = null;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  // Two more shows for the library-wide pass: 4 episodes, TMDb flat, TVDB 2 + 2.
  const extra = [990002, 990003, 990004, 990005].find((id) => url.pathname.startsWith(`/3/tv/${id}`));
  const extraTvdb = [880002, 880003, 880004, 880005].find((id) => url.pathname.includes(`/series/${id}`));
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
  if (url.pathname === "/torrents" && engineTorrents) return json({ torrents: engineTorrents });
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

// ffprobe analyses already known for the two files the resync will rename.
const { getFfprobeVersion } = await import("../src/lib/playback/engine/mediaProbe.ts");
const probeCache = await import("../src/lib/playback/engine/mediaProbeCache.ts");
const ffprobeVersion = await getFfprobeVersion();
fs.writeFileSync(path.join(config, "media-probe-cache.json"), JSON.stringify([5, 6].map((e) => {
  const st = fs.statSync(file(1, e));
  return { mediaId: `sr_e2e:s1e${e}`, path: file(1, e), size: st.size, mtimeMs: st.mtimeMs, probeVersion: 1, ffprobeVersion, updatedAt: 1,
    descriptor: { mediaId: `sr_e2e:s1e${e}`, source: { type: "local" }, container: `probed-ep${e}`, video: {}, audioTracks: [], subtitleTracks: [] } };
})));

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
  // The analysis followed each renamed file: answered from the cache (these
  // are not videos — a real ffprobe run would fail), under its new number.
  assert.equal((await probeCache.getOrProbeMediaDescriptor("sr_e2e:s2e2", s2[1].file!.path, false, { priority: "background" }))?.container, "probed-ep5");
  assert.equal((await probeCache.getOrProbeMediaDescriptor("sr_e2e:s2e3", s2[2].file!.path, false, { priority: "background" }))?.container, "probed-ep6");
  assert.equal(probeCache.hasCachedMediaDescriptor("sr_e2e:s1e5"), false);
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

test("a rename an earlier pass had to leave is finished by the next click, never by the background pass", async () => {
  const { updateSeries } = await import("../src/lib/library/store.ts");
  const before = getSeries("sr_e2e")!;
  const good = before.seasons[1].episodes[1].file!.path; // …S02E02…
  const wrong = path.join(path.dirname(good), "Arc Show - S01E05.mkv");
  fs.renameSync(good, wrong);
  // The state an incomplete rename leaves: right episode, old name, a stale order still recorded for Plex.
  updateSeries("sr_e2e", { plexOrderPending: "tmdb", seasons: before.seasons.map((s) => ({ ...s, episodes: s.episodes.map((e) => e.file?.path === good ? { ...e, file: { ...e.file, path: wrong, diskPath: wrong } } : e) })) });

  const background = await resyncAnimeSeasonsFromTvdb("sr_e2e", { background: true });
  assert.equal(background.ok && background.renamedFiles, 0);
  assert.ok(fs.existsSync(wrong));

  const clicked = await resyncAnimeSeasonsFromTvdb("sr_e2e");
  assert.equal(clicked.ok && clicked.renamedFiles, 1, JSON.stringify(clicked));
  const after = getSeries("sr_e2e")!;
  assert.equal(after.seasons[1].episodes[1].file!.path, good);
  assert.equal(fs.readFileSync(good, "utf8"), "ep5");
  assert.ok(!fs.existsSync(wrong));
  assert.equal(after.plexOrderPending, "tvdb", "the order Plex is asked for is the series' real one");
  // And once everything is in place, a further click changes nothing.
  const again = await resyncAnimeSeasonsFromTvdb("sr_e2e");
  assert.equal(again.ok && again.unchanged, true);
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

test("every client sees the library structure of a TVDB series, with the right TMDb stills (web, Android, Tizen share these routes)", async () => {
  const { projectSeasonSummaries, projectSeason, libraryCoordinateFromTmdb, tvdbOrderedSeries } = await import("../src/lib/library/tvdbProjection.ts");
  const series = tvdbOrderedSeries(TMDB_ID)!;
  assert.ok(series, "marked TVDB by the resync");
  assert.deepEqual(projectSeasonSummaries(series).map((x) => `${x.seasonNumber}:${x.episodeCount}`), ["1:2", "2:5"]);
  const s2 = (await projectSeason(series, 2))!;
  // TVDB S2E1 is the 3rd broadcast: TMDb's S1E3 still and synopsis, never TMDb's (non-existent) S2E1.
  assert.equal(s2.episodes[0].stillPath, "/still3.jpg");
  assert.equal(s2.episodes[0].overview, "Résumé TMDb 3");
  assert.equal(s2.episodes[0].title, series.seasons[1].episodes[0].title);
  // A watched mark imported with TMDb numbers lands on the library episode.
  assert.deepEqual(libraryCoordinateFromTmdb(TMDB_ID, 1, 4), { season: 2, episode: 2 });
  assert.equal(libraryCoordinateFromTmdb(TMDB_ID, 1, 99), null);
  assert.deepEqual(libraryCoordinateFromTmdb(123, 1, 4), { season: 1, episode: 4 }, "any other show: unchanged");
});

test("season titles shown to every client: never Japanese script, one name for season 0", async () => {
  const { projectSeasonSummaries, projectSeason, tvdbOrderedSeries } = await import("../src/lib/library/tvdbProjection.ts");
  const series = tvdbOrderedSeries(TMDB_ID)!;
  const stored = { ...series, seasons: [
    { seasonNumber: 0, name: "Saison 0", monitored: false, episodes: [] },
    { ...series.seasons[0], name: "日光・華厳の滝編" },
    { ...series.seasons[1], name: "Arc Deux" },
  ] };
  assert.deepEqual(projectSeasonSummaries(stored).map((x) => x.name), ["Épisodes spéciaux", "Saison 1", "Arc Deux"]);
  assert.equal((await projectSeason(stored, 1))!.name, "Saison 1");
  assert.equal((await projectSeason(stored, 0))!.name, "Épisodes spéciaux");
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

test("« Vu » follow their episode: a profile that watched TMDb S1E3 sees TVDB S2E1 watched, same date, after the resync", async () => {
  const { addUser } = await import("../src/lib/auth/store.ts");
  const { getWatchStatus, setWatchedEpisodes } = await import("../src/lib/plex/watchStore.ts");
  addUser({ id: "viewer", username: "viewer", passwordHash: null, role: "user", status: "active", autoApproveRequests: false, autoRequestFromWatchlist: false, discoverContinents: [] } as never);
  const dir = path.join(media, "Watched Show");
  const f = (e: number) => path.join(dir, "Saison 1", `Watched Show - S01E0${e}.mkv`);
  for (let e = 1; e <= 4; e++) write(f(e), `w${e}`);
  addSeries({ id: "sr_watch", tmdbId: 990004, imdbId: null, title: "Watched Show", year: 2017, releaseDate: day(100), overview: "", posterPath: null, backdropPath: null, rating: 0, genres: ["Animation"], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null,
    seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [1, 2, 3, 4].map((e) => ({ ...ep(1, e, f(e)), airDate: day(99 + e) })) }] } as never);
  const at = Date.UTC(2020, 0, 2);
  setWatchedEpisodes("viewer", [{ tmdbId: 990004, season: 1, episode: 3, watchedAt: at }], true, "Watched Show", "plex_history");
  const result = await resyncAnimeSeasonsFromTvdb("sr_watch");
  assert.equal(result.ok, true, JSON.stringify(result));
  const mine = getWatchStatus("viewer")!.episodes.filter((e) => e.tmdbId === 990004);
  const moved = mine.find((e) => e.season === 2 && e.episode === 1);
  assert.ok(moved, JSON.stringify(mine));
  assert.equal(moved!.at, at, "the original watch date is kept");
  assert.ok(!mine.some((e) => e.season === 2 && e.episode === 2), "nothing else marked");
});

test("marks left on old TMDb numbers by an earlier resync are caught up, even when nothing else changes", async () => {
  const { getWatchStatus, setWatchedEpisodes } = await import("../src/lib/plex/watchStore.ts");
  // TMDb S1E4 no longer exists in the library (it is TVDB S2E2 now).
  setWatchedEpisodes("viewer", [{ tmdbId: 990004, season: 1, episode: 4, watchedAt: Date.UTC(2020, 0, 3) }], true, "Watched Show", "plex_history");
  const result = await resyncAnimeSeasonsFromTvdb("sr_watch");
  assert.equal(result.ok && result.unchanged, true, JSON.stringify(result));
  assert.ok(getWatchStatus("viewer")!.episodes.some((e) => e.tmdbId === 990004 && e.season === 2 && e.episode === 2));
});

test("Saint Seiya / Lost Canvas: another show's files wrongly shared are let go, this show's own files take their place", async () => {
  const lc = (e: number) => path.join(media, "Spin Off", "Saison 1", `Spin Off - S01E0${e}.mkv`);
  const own = (e: number) => path.join(media, "Main Show", "Saison 1", `Main Show - S01E0${e}.mkv`);
  for (let e = 1; e <= 4; e++) { write(lc(e), `spin${e}`); write(own(e), `main${e}`); }
  // The spin-off owns its files…
  addSeries({ ...{ imdbId: null, year: 2009, releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0, genres: [], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null },
    id: "sr_spin", tmdbId: 990099, title: "Spin Off", seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [1, 2, 3, 4].map((e) => ep(1, e, lc(e))) }] } as never);
  // …and the main show links them too (episodes 1–2), its own files 3–4.
  addSeries({ id: "sr_main", tmdbId: 990005, imdbId: null, title: "Main Show", year: 2017, releaseDate: day(100), overview: "", posterPath: null, backdropPath: null, rating: 0, genres: ["Animation"], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey: null,
    seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [1, 2, 3, 4].map((e) => ({ ...ep(1, e, e <= 2 ? lc(e) : own(e)), airDate: day(99 + e) })) }] } as never);
  const result = await resyncAnimeSeasonsFromTvdb("sr_main");
  assert.equal(result.ok, true, JSON.stringify(result));
  const main = getSeries("sr_main")!;
  const linked = main.seasons.flatMap((x) => x.episodes).map((e) => e.file && fs.readFileSync(e.file.path, "utf8"));
  assert.deepEqual(linked, ["main1", "main2", "main3", "main4"], "only the main show's own files");
  assert.ok(getSeries("sr_spin")!.seasons[0].episodes.every((e, i) => e.file!.path === lc(i + 1)), "spin-off untouched");
  for (let e = 1; e <= 4; e++) assert.ok(fs.existsSync(lc(e)), "nothing trashed");
});

test("« Forcer TMDb » on a title's page: back to TMDb numbering, files renamed, Plex asked for TMDb, and no automatic TVDB resync ever again", async () => {
  const { updateSeries } = await import("../src/lib/library/store.ts");
  const { alignAnimeLibraryOnTvdb } = await import("../src/lib/library/animeTvdbAlign.ts");
  // « Old Show » was put in TVDB layout (2 + 2) by the library-wide pass above.
  const before = getSeries("sr_old")!;
  assert.equal(before.episodeOrder, "tvdb");

  updateSeries("sr_old", { forceTmdbOrder: true });
  const forced = await resyncAnimeSeasonsFromTvdb("sr_old", { forceTmdb: true });
  assert.equal(forced.ok, true, JSON.stringify(forced));
  if (!forced.ok) return;
  assert.equal(forced.source, "tmdb");
  const after = getSeries("sr_old")!;
  assert.deepEqual(after.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:4"]);
  assert.equal(after.episodeOrder, undefined);
  assert.equal(after.plexOrderPending, "tmdb");
  const files = after.seasons[0].episodes.map((e) => e.file!.path);
  assert.deepEqual(files.map((p) => fs.readFileSync(p, "utf8")), ["Old Show1", "Old Show2", "Old Show3", "Old Show4"]);
  files.forEach((p, i) => assert.match(path.basename(p), new RegExp(`S01E0${i + 1}`)));

  // Nothing automatic touches it any more: daily pass, library-wide pass, even a plain resync call.
  const snapshot = JSON.stringify(getSeries("sr_old")!.seasons);
  const background = await resyncAnimeSeasonsFromTvdb("sr_old", { background: true });
  assert.equal(background.ok && background.unchanged, true);
  await alignAnimeLibraryOnTvdb({ background: true });
  const plain = await resyncAnimeSeasonsFromTvdb("sr_old");
  assert.equal(plain.ok && plain.unchanged, true);
  assert.equal(JSON.stringify(getSeries("sr_old")!.seasons), snapshot);
  assert.equal(getSeries("sr_old")!.episodeOrder, undefined);

  // Lifting the choice only brings the TVDB resync back: a click then returns to TVDB.
  updateSeries("sr_old", { forceTmdbOrder: undefined });
  assert.equal(JSON.stringify(getSeries("sr_old")!.seasons), snapshot);
  const back = await resyncAnimeSeasonsFromTvdb("sr_old");
  assert.equal(back.ok && back.source, "tvdb");
  assert.deepEqual(getSeries("sr_old")!.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:2", "2:2"]);
});

test("« Forcer TMDb » while a download is running: the choice holds, a later pass finishes the conversion towards TMDb", async () => {
  const { updateSeries } = await import("../src/lib/library/store.ts");
  const tvdbState = getSeries("sr_old")!;
  assert.equal(tvdbState.episodeOrder, "tvdb");
  const busy = tvdbState.seasons.map((s, i) => ({ ...s, episodes: s.episodes.map((e, j) => i === 0 && j === 0 ? { ...e, activeInfoHash: "abc" } : e) }));
  updateSeries("sr_old", { forceTmdbOrder: true, seasons: busy });
  const blocked = await resyncAnimeSeasonsFromTvdb("sr_old", { forceTmdb: true });
  assert.deepEqual(blocked, { ok: false, error: "active_downloads" });
  assert.equal(getSeries("sr_old")!.forceTmdbOrder, true);
  // Download over: the ordinary background pass now converts it — to TMDb, never back to TVDB.
  updateSeries("sr_old", { seasons: getSeries("sr_old")!.seasons.map((s) => ({ ...s, episodes: s.episodes.map((e) => ({ ...e, activeInfoHash: null })) })) });
  const later = await resyncAnimeSeasonsFromTvdb("sr_old", { background: true });
  assert.equal(later.ok && later.source, "tmdb", JSON.stringify(later));
  assert.deepEqual(getSeries("sr_old")!.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:4"]);
  assert.equal(getSeries("sr_old")!.episodeOrder, undefined);
});

test("a finished torrent still referenced by available episodes is not a download in progress (Naruto Shippuden / Pokémon were shut out of every resync)", async () => {
  const { updateSeries } = await import("../src/lib/library/store.ts");
  const { episodeHasLiveDownload, torrentIsSettled } = await import("../src/lib/library/autoGrabSeries.ts");
  const now = Date.now();
  // What "over" means, torrent by torrent.
  assert.equal(torrentIsSettled(undefined, now), true, "the engine no longer has it");
  assert.equal(torrentIsSettled({ state: "seeding", progress: 1, completedAt: now - 3_600_000 }, now), true);
  assert.equal(torrentIsSettled({ state: "seeding", progress: 1, completedAt: now - 60_000 }, now), false, "just finished: its import may still be running");
  assert.equal(torrentIsSettled({ state: "downloading", progress: 0.4, completedAt: null }, now), false);
  assert.equal(torrentIsSettled({ state: "seeding", progress: 1, completedAt: null }, now), false, "no completion date: not trusted");
  assert.equal(torrentIsSettled({ state: "paused", progress: 1, completedAt: now - 3_600_000 }, now), false);
  assert.equal(torrentIsSettled({ state: "completed", progress: 1, completedAt: null, imported: true }, now), true);
  // And episode by episode.
  const base = getSeries("sr_old")!.seasons[0].episodes[0];
  const settled = new Set(["aaa"]);
  assert.equal(episodeHasLiveDownload({ ...base, activeInfoHash: "AAA" }, settled), false, "available, has its file, torrent over");
  assert.equal(episodeHasLiveDownload({ ...base, activeInfoHash: "bbb" }, settled), true, "another torrent, not known to be over");
  assert.equal(episodeHasLiveDownload({ ...base, status: "downloading", activeInfoHash: "aaa" }, settled), true);
  assert.equal(episodeHasLiveDownload({ ...base, status: "missing", file: null, activeInfoHash: "aaa" }, settled), true, "no file yet: still expected from that torrent");
  assert.equal(episodeHasLiveDownload({ ...base, status: "searching", activeInfoHash: null }, settled), true);
  assert.equal(episodeHasLiveDownload({ ...base, activeInfoHash: null }, settled), false);

  // Whole flow: « Old Show » is in TMDb numbering with TMDb forced lifted… put it back to a plain state first.
  updateSeries("sr_old", { forceTmdbOrder: undefined });
  const tag = (hash: string | null) => updateSeries("sr_old", { seasons: getSeries("sr_old")!.seasons.map((x) => ({ ...x, episodes: x.episodes.map((e) => ({ ...e, activeInfoHash: hash })) })) });
  tag("deadbeef");
  // Engine unreachable: nobody can tell, so the hash still counts as a download.
  engineTorrents = null;
  assert.deepEqual(await resyncAnimeSeasonsFromTvdb("sr_old"), { ok: false, error: "active_downloads" });
  // Engine up, torrent really downloading: still refused.
  engineTorrents = [{ infoHash: "DEADBEEF", state: "downloading", progress: 0.5, completedAt: null }];
  assert.deepEqual(await resyncAnimeSeasonsFromTvdb("sr_old"), { ok: false, error: "active_downloads" });
  // Engine up and it no longer has that torrent: the resync goes through.
  engineTorrents = [];
  const done = await resyncAnimeSeasonsFromTvdb("sr_old");
  assert.equal(done.ok && done.source, "tvdb", JSON.stringify(done));
  assert.deepEqual(getSeries("sr_old")!.seasons.map((x) => `${x.seasonNumber}:${x.episodes.length}`), ["1:2", "2:2"]);
  engineTorrents = null;
});
