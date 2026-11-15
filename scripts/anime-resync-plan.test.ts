import test from "node:test";
import assert from "node:assert/strict";
import { planAnimeResync, alignCatalogs, type CatalogEpisode, type ResyncFile, type ResyncPlan } from "../src/lib/library/animeResyncPlan.ts";
import { pickTvdbSearchMatch } from "../src/lib/metadata/tvdb.ts";
import type { LibraryEpisode, LibrarySeason } from "../src/lib/library/types.ts";

const DAY = 86_400_000;
const date = (n: number) => new Date(Date.UTC(2005, 9, 1) + n * 7 * DAY).toISOString().slice(0, 10);
const isCjk = (t: string) => /[぀-ヿ一-鿿]/.test(t);
const statusFor = (eps: CatalogEpisode[]) => new Map(eps.map((e) => [e.episodeNumber, "missing" as const]));

/** One continuous run of `total` weekly episodes split into seasons of the given sizes. */
function catalog(sizes: number[], startWeek = 0, prefix = "Titre"): CatalogEpisode[] {
  const out: CatalogEpisode[] = [];
  let abs = 0;
  sizes.forEach((size, i) => {
    for (let e = 1; e <= size; e++) out.push({ seasonNumber: i + 1, episodeNumber: e, title: `${prefix} ${abs + 1}`, airDate: date(startWeek + abs++) });
  });
  return out;
}
const diskFile = (p: string) => ({ path: p, quality: "WEB", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null, size: 1, addedAt: 1 });
const pathOf = (s: number, e: number) => `/data/anime/Show/Saison ${s}/Show - S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}.mkv`;
function ep(s: number, e: number, airDate: string | null, file: string | null, extra: Partial<LibraryEpisode> = {}): LibraryEpisode {
  return {
    seasonNumber: s, episodeNumber: e, title: `Ancien ${s}x${e}`, airDate, monitored: true,
    status: file ? "available" : "missing",
    file: file ? { path: file, quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: "WEB", size: 1000, addedAt: 42 } : null,
    activeInfoHash: null, plexRatingKey: file ? `plex-${s}-${e}` : null, ...extra,
  };
}
function seasonsFrom(eps: LibraryEpisode[]): LibrarySeason[] {
  const by = new Map<number, LibraryEpisode[]>();
  for (const e of eps) by.set(e.seasonNumber, [...(by.get(e.seasonNumber) ?? []), e]);
  return [...by].map(([n, list]) => ({ seasonNumber: n, name: `Ancienne ${n}`, monitored: true, episodes: list }));
}
function filesOf(seasons: LibrarySeason[]): ResyncFile[] {
  const seen = new Map<string, ResyncFile>();
  for (const s of seasons) for (const e of s.episodes) {
    if (!e.file || seen.has(e.file.path)) continue;
    const m = e.file.path.match(/S(\d+)E(\d+)/)!;
    seen.set(e.file.path, { path: e.file.path, literal: { seasonNumber: +m[1], episodeNumber: +m[2] }, size: e.file.size });
  }
  return [...seen.values()];
}
function run(oldSeasons: LibrarySeason[], tvdb: CatalogEpisode[], tmdb: CatalogEpisode[] | null, files = filesOf(oldSeasons), includeSpecials = true): ResyncPlan {
  const plan = planAnimeResync({ oldSeasons, tvdb, tmdb, tvdbSeasonNames: new Map([[2, "Arc 2"]]), tmdbSeasonNames: new Map([[1, "Saison 1"]]), files, includeSpecials, isCjk, statusFor });
  assert.equal(plan.ok, true);
  return plan as ResyncPlan;
}
const find = (plan: ResyncPlan, s: number, e: number) => plan.seasons.find((x) => x.seasonNumber === s)?.episodes.find((x) => x.episodeNumber === e);
const counts = (plan: ResyncPlan) => plan.seasons.map((s) => `${s.seasonNumber}:${s.episodes.length}`).join(" ");
const noDuplicateFiles = (plan: ResyncPlan) => {
  const paths = plan.seasons.flatMap((s) => s.episodes.flatMap((e) => (e.file ? [e.file.path] : [])));
  assert.equal(new Set(paths).size, paths.length, "a file is linked to two episodes");
};

test("Blood+ : TMDb flat S1 + TVDB arcs both on disk → one structure, the double copies flagged", () => {
  const tmdb = catalog([50]);
  const tvdb = catalog([13, 12, 13, 12]);
  // Prod state: S1 kept in TMDb numbering (50, all files) next to TVDB S2–S4 (files too).
  const old = seasonsFrom([
    ...tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))),
    ...tvdb.filter((c) => c.seasonNumber > 1).map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, pathOf(c.seasonNumber, c.episodeNumber))),
  ]);
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.source, "tvdb");
  assert.equal(counts(plan), "1:13 2:12 3:13 4:12");
  noDuplicateFiles(plan);
  // The copy already named after the TVDB coordinate is kept (Plex numbers it so).
  assert.equal(find(plan, 2, 1)!.file!.path, pathOf(2, 1));
  assert.equal(find(plan, 2, 1)!.plexRatingKey, "plex-2-1");
  assert.equal(plan.duplicates.length, 37);
  assert.ok(plan.duplicates.every((d) => d.verified));
  assert.deepEqual(plan.duplicates.find((d) => d.seasonNumber === 2 && d.episodeNumber === 1), { seasonNumber: 2, episodeNumber: 1, keptPath: pathOf(2, 1), droppedPath: pathOf(1, 14), verified: true });
  assert.ok(plan.seasons.every((s) => s.episodes.every((e) => e.status === "available")));
});

test("Dragon Ball Super : only TMDb-named files → each one moves onto its TVDB episode, nothing deleted", () => {
  const tmdb = catalog([131]);
  const tvdb = catalog([14, 13, 19, 30, 55]);
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber), { monitored: c.episodeNumber !== 20 })));
  const plan = run(old, tvdb, tmdb);
  assert.equal(counts(plan), "1:14 2:13 3:19 4:30 5:55");
  assert.equal(plan.duplicates.length, 0);
  assert.equal(plan.movedFiles, 117);
  noDuplicateFiles(plan);
  assert.equal(find(plan, 2, 1)!.file!.path, pathOf(1, 15));
  assert.equal(find(plan, 5, 55)!.file!.path, pathOf(1, 131));
  // Monitoring choice and file record travel with the episode.
  assert.equal(find(plan, 2, 6)!.monitored, false);
  assert.equal(find(plan, 2, 6)!.file!.addedAt, 42);
  assert.equal(find(plan, 2, 1)!.title, "Ancien 1x15");
});

test("re-running on an already-repaired library changes nothing", () => {
  const tmdb = catalog([131]);
  const tvdb = catalog([14, 13, 19, 30, 55]);
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))));
  const first = run(old, tvdb, tmdb);
  const second = run(first.seasons, tvdb, tmdb);
  assert.equal(second.movedFiles, 0);
  assert.equal(second.duplicates.length, 0);
  assert.deepEqual(second.seasons, first.seasons);
});

test("Fate/UBW : TVDB is not more granular → TMDb structure kept, files untouched", () => {
  const tmdb = catalog([12, 13]);
  const tvdb = catalog([25]);
  const old = seasonsFrom(tmdb.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, pathOf(c.seasonNumber, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.source, "tmdb");
  assert.equal(counts(plan), "1:12 2:13");
  assert.equal(plan.movedFiles, 0);
  assert.equal(find(plan, 2, 1)!.file!.path, pathOf(2, 1));
  assert.equal(find(plan, 2, 1)!.plexRatingKey, "plex-2-1");
});

test("a TVDB-named file in a TMDb-structured show lands on the same episode by air date", () => {
  const tmdb = catalog([12, 13]);
  const tvdb = catalog([25]);
  const old = seasonsFrom(tmdb.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, null)));
  const plan = run(old, tvdb, tmdb, [{ path: "/x/Saison 1/Show - S01E20.mkv", literal: { seasonNumber: 1, episodeNumber: 20 }, size: 5, diskFile: diskFile("/x/Saison 1/Show - S01E20.mkv") }]);
  assert.equal(find(plan, 2, 8)!.file!.path, "/x/Saison 1/Show - S01E20.mkv");
  assert.equal(plan.movedFiles, 0);
  assert.equal(find(plan, 2, 8)!.status, "available");
});

test("a season TMDb announces before TVDB lists it stays on the fiche, after TVDB's last season", () => {
  const tmdb = [...catalog([50]), { seasonNumber: 2, episodeNumber: 1, title: "À venir", airDate: "2027-01-10" }, { seasonNumber: 2, episodeNumber: 2, title: "", airDate: null }];
  const tvdb = catalog([13, 12, 13, 12]);
  const old = seasonsFrom([...tmdb.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, null)), ]);
  old[1].episodes[0].monitored = false;
  const plan = planAnimeResync({ oldSeasons: old, tvdb, tmdb, tvdbSeasonNames: new Map(), tmdbSeasonNames: new Map([[2, "Saison 2 (2027)"]]), files: [], includeSpecials: true, isCjk, statusFor }) as ResyncPlan;
  assert.equal(plan.source, "tvdb");
  assert.equal(counts(plan), "1:13 2:12 3:13 4:12 5:2");
  assert.equal(plan.seasons.at(-1)!.name, "Saison 2 (2027)");
  assert.equal(find(plan, 5, 1)!.title, "Ancien 2x1"); // same episode: its existing title is kept
  assert.equal(find(plan, 5, 1)!.monitored, false);
});

test("Lost Canvas : no TVDB match → a structure borrowed from another show is replaced by TMDb's", () => {
  const tmdb = catalog([26], 200);
  const wrong = catalog([73, 26, 15, 13, 12, 6, 13, 13, 51, 46, 13, 10]); // Saint Seiya franchise
  const old = seasonsFrom([
    ...wrong.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, null)),
    ...Array.from({ length: 26 }, (_, i) => i + 1).map((n) => ({ ...ep(1, n, null, pathOf(1, n)) })),
  ].filter((e, i, all) => all.findIndex((x) => x.seasonNumber === e.seasonNumber && x.episodeNumber === e.episodeNumber && (x.file || !e.file)) === i));
  const plan = run(old, [], tmdb);
  assert.equal(plan.source, "tmdb");
  assert.equal(counts(plan), "1:26");
  assert.ok(plan.seasons[0].episodes.every((e) => e.file));
});

test("ambiguous numbers follow their folder's numbering", () => {
  // TMDb 25 + 25, TVDB 13 + 12 + 25: "S02E05" exists in both, meaning different episodes.
  const tmdb = catalog([25, 25]);
  const tvdb = catalog([13, 12, 25]);
  const tmdbFolder = Array.from({ length: 25 }, (_, i) => ({ path: `/d/Saison 2/Show - S02E${String(i + 1).padStart(2, "0")}.mkv`, literal: { seasonNumber: 2, episodeNumber: i + 1 }, size: 1, diskFile: diskFile(`/d/Saison 2/Show - S02E${String(i + 1).padStart(2, "0")}.mkv`) }));
  const plan = run(seasonsFrom(tmdb.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, null))), tvdb, tmdb, tmdbFolder);
  // S02E13..25 only exist in TMDb numbering, so the whole folder is TMDb: S02E05 = absolute 30 = TVDB S3E5.
  assert.equal(find(plan, 3, 5)!.file!.path, "/d/Saison 2/Show - S02E05.mkv");
  assert.equal(find(plan, 2, 5)!.file, null);
});

test("air dates realign around an episode only one catalogue lists", () => {
  const tmdb = catalog([20]);
  // TVDB has an extra recap aired between absolute 10 and 11.
  const tvdb: CatalogEpisode[] = [
    ...catalog([10]),
    { seasonNumber: 2, episodeNumber: 1, title: "Récap", airDate: "2006-12-25" },
    ...catalog([10]).map((e, i) => ({ seasonNumber: 2, episodeNumber: i + 2, title: e.title, airDate: date(10 + i) })),
  ];
  const map = alignCatalogs(tmdb, tvdb);
  assert.deepEqual(map.get("1-11"), { key: "2-2", verified: true });
  assert.deepEqual(map.get("1-20"), { key: "2-11", verified: true });
});

test("a file no catalogue knows stays linked as an extra episode", () => {
  const tmdb = catalog([12]);
  const tvdb = catalog([6, 6]);
  const old = seasonsFrom([...tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, null)), ep(1, 40, null, pathOf(1, 40))]);
  const plan = run(old, tvdb, tmdb);
  assert.deepEqual(plan.extras, [pathOf(1, 40)]);
  assert.equal(find(plan, 1, 40)!.file!.path, pathOf(1, 40));
});

test("specials are left out when the setting is off", () => {
  const tmdb = catalog([12]);
  const tvdb = [{ seasonNumber: 0, episodeNumber: 1, title: "OVA", airDate: null }, ...catalog([6, 6])];
  const plan = run(seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, null))), tvdb, tmdb, [], false);
  assert.equal(counts(plan), "1:6 2:6");
});

test("a two-episode file blocks a move instead of breaking its mapping", () => {
  const tmdb = catalog([12]);
  const tvdb = catalog([6, 6]);
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber), c.episodeNumber === 8 ? { combinedFile: { fileEpisodeNumber: 8, firstEpisodeNumber: 8, lastEpisodeNumber: 9 } } : {})));
  const result = planAnimeResync({ oldSeasons: old, tvdb, tmdb, tvdbSeasonNames: new Map(), tmdbSeasonNames: new Map(), files: filesOf(old), includeSpecials: true, isCjk, statusFor });
  assert.deepEqual(result, { ok: false, error: "combined_files" });
});

test("TVDB name search only trusts the same show", () => {
  const results = [
    { tvdbId: 72775, name: "Saint Seiya", year: 1986 },
    { tvdbId: 1, name: "Saint Seiya: The Lost Canvas", year: 2009 },
  ];
  assert.equal(pickTvdbSearchMatch(results.slice(0, 1), "Saint Seiya - The Lost Canvas", 2009), null);
  assert.equal(pickTvdbSearchMatch(results, "Saint Seiya - The Lost Canvas", 2009)?.tvdbId, 1);
  assert.equal(pickTvdbSearchMatch([{ tvdbId: 9, name: "Panty & Stocking with Garterbelt", year: 2010 }], "New PANTY & STOCKING with GARTERBELT", 2025), null);
  assert.equal(pickTvdbSearchMatch([{ tvdbId: 5, name: "Something Else", year: 2009 }], "Saint Seiya - The Lost Canvas", 2009), null);
  assert.equal(pickTvdbSearchMatch([{ tvdbId: 7, name: "Chimi Chara", year: null }], "Chimi Chara", null)?.tvdbId, 7);
});

test("Saint Seiya : TVDB's franchise seasons TMDb keeps as other series are left out", () => {
  const tmdb = catalog([114]);
  const tvdb = [...catalog([73, 26, 15]), ...catalog([13, 12], 900).map((e) => ({ ...e, seasonNumber: e.seasonNumber + 3 }))];
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.source, "tvdb");
  assert.equal(counts(plan), "1:73 2:26 3:15");
  assert.equal(find(plan, 3, 15)!.file!.path, pathOf(1, 114));
  noDuplicateFiles(plan);
});

test("one TMDb episode with a wrong air date still lands between its neighbours", () => {
  const tmdb = catalog([30]);
  tmdb[19] = { ...tmdb[19], airDate: "2001-01-01" };
  const tvdb = catalog([10, 10, 10]);
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(find(plan, 2, 10)!.file!.path, pathOf(1, 20));
  assert.deepEqual(plan.extras, []);
});

test("DBZ Kai : a library already in TVDB layout stays in it even when TMDb has more seasons", () => {
  const tmdb = catalog([27, 26, 25, 20, 35, 26]);
  const tvdb = catalog([98, 61]);
  const old = seasonsFrom(tvdb.map((c) => ep(c.seasonNumber, c.episodeNumber, c.airDate, pathOf(c.seasonNumber, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.source, "tvdb");
  assert.equal(counts(plan), "1:98 2:61");
  assert.equal(plan.movedFiles, 0);
  assert.equal(find(plan, 2, 61)!.plexRatingKey, "plex-2-61");
});

test("Chobits : a healthy TMDb library is never reshuffled because TMDb renumbered since", () => {
  const tmdb = catalog([26]);
  const tvdb = catalog([24]);
  const old = seasonsFrom(catalog([24]).map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.movedFiles, 0);
  assert.deepEqual(plan.seasons.map((s) => s.episodes.map((e) => e.file?.path)), old.map((s) => s.episodes.map((e) => e.file?.path)));
});

test("specials switched off: an existing season 0 is kept untouched, never deleted", () => {
  const tmdb = catalog([12]);
  const tvdb = catalog([6, 6]);
  const special: LibraryEpisode = { ...ep(0, 1, null, null), title: "OVA" };
  const old = [...seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, null))), { seasonNumber: 0, name: "Spéciaux", monitored: false, episodes: [special] }];
  const plan = run(old, tvdb, tmdb, [], false);
  assert.equal(counts(plan), "0:1 1:6 2:6");
  assert.equal(find(plan, 0, 1)!.title, "OVA");
});

test("Saint Seiya: when TVDB's dates can't host every file, the show stays on TMDb's structure", () => {
  // Same total (10) but TVDB packs it into 8 consecutive weeks and adds two
  // episodes TMDb doesn't list, while TMDb's last two aired months later.
  // TMDb skips weeks 4–5 (two episodes only TVDB lists, mid-run) and airs its last two months later.
  const tmdb = [...catalog([8]).map((e) => ({ ...e, airDate: date(e.episodeNumber <= 4 ? e.episodeNumber - 1 : e.episodeNumber + 1) })), { seasonNumber: 1, episodeNumber: 9, title: "Poséidon 1", airDate: date(40) }, { seasonNumber: 1, episodeNumber: 10, title: "Poséidon 2", airDate: date(41) }];
  const tvdb = [...catalog([4]), ...catalog([6], 4).map((e) => ({ ...e, seasonNumber: 2 }))];
  const old = seasonsFrom(tmdb.map((c) => ep(1, c.episodeNumber, c.airDate, pathOf(1, c.episodeNumber))));
  const plan = run(old, tvdb, tmdb);
  assert.equal(plan.source, "tmdb");
  assert.deepEqual(plan.extras, []);
  assert.equal(counts(plan), "1:10");
  noDuplicateFiles(plan);
  assert.ok(plan.seasons[0].episodes.every((e) => e.file));
});

test("season names are never left in Japanese: an untranslated TVDB arc name, new or already stored, becomes « Saison N »", () => {
  // TVDB splits 4 episodes in two arcs; the library already holds that layout,
  // with the Japanese arc names an earlier resync stored.
  const tvdb = catalog([2, 2]);
  const tmdb = catalog([4]);
  const old = seasonsFrom([ep(1, 1, date(0), pathOf(1, 1)), ep(1, 2, date(1), pathOf(1, 2)), ep(2, 1, date(2), pathOf(2, 1)), ep(2, 2, date(3), pathOf(2, 2))]);
  old[0].name = "日光・華厳の滝編";
  old[1].name = "京都編&練馬編";
  const plan = planAnimeResync({ oldSeasons: old, tvdb, tmdb, tvdbSeasonNames: new Map([[1, "L'arc de Nikko"], [2, "京都編&練馬編"]]), tmdbSeasonNames: new Map(), files: filesOf(old), includeSpecials: true, isCjk, statusFor }) as ResyncPlan;
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.seasons.map((s) => s.name), ["L'arc de Nikko", "Saison 2"]);
});
