import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BLEACH_ORIGINAL_COUNTS, detectBleachLibraryOrder, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachCompletePackCovers, bleachReleaseTargets } from "@/lib/library/bleachRelease";
import { BLEACH_SEASON_CONTENT } from "@/lib/metadata/bleachSeasonContent";
import { BLEACH_LOGOS, bleachPartArtwork } from "@/lib/metadata/bleachArtwork";
import type { LibrarySeries, LibraryEpisode } from "@/lib/library/types";

function canonicalCatalogue() {
  return { tmdbId: 30984, seasons: BLEACH_ORIGINAL_COUNTS.map((count, index) => ({
    seasonNumber: index + 1,
    episodes: Array.from({ length: count }, (_, i) => ({ episodeNumber: i + 1 })),
  })).concat([{ seasonNumber: 17, episodes: Array.from({ length: 53 }, (_, i) => ({ episodeNumber: i + 1 })) }]) };
}

test("existing full TVDB catalogue without marker is already canonical, with no history migration", () => {
  const series = canonicalCatalogue();
  const before = JSON.stringify(series);
  assert.equal(detectBleachLibraryOrder(series), "tvdb");
  assert.equal(needsBleachRepair(series), false);
  assert.equal(JSON.stringify(series), before);
  series.seasons[6].episodes[0].episodeNumber = 2;
  assert.equal(detectBleachLibraryOrder(series), "ambiguous");
  assert.equal(needsBleachRepair(series), true);
  assert.equal(detectBleachLibraryOrder({ tmdbId: 30984, seasons: [{ seasonNumber: 2, episodes: [{ episodeNumber: 1 }] }] }), "ambiguous");
});

test("all sixteen seasons have distinct shipped artwork and an arc synopsis", () => {
  assert.equal(BLEACH_SEASON_CONTENT.length, 16);
  const images = new Set<string>();
  for (const season of BLEACH_SEASON_CONTENT) {
    assert.ok(season.overview.length > 50);
    assert.ok(season.name.length > 3);
    assert.ok(fs.statSync(path.join(process.cwd(), "public", season.posterUrl)).size > 1000);
    images.add(season.posterUrl);
  }
  assert.equal(images.size, 16);
  assert.notEqual(BLEACH_LOGOS.original, BLEACH_LOGOS.tybw);
  assert.equal(bleachPartArtwork({}, "original").customLogoPath, BLEACH_LOGOS.original);
  assert.equal(bleachPartArtwork({}, "tybw").customLogoPath, BLEACH_LOGOS.tybw);
});

test("TYBW multi-cour packs cover exactly the selected part and accept a season pack for one episode", () => {
  const targets = Array.from({ length: 40 }, (_, i) => ({ season: 17, episode: i + 1 }));
  assert.equal(bleachCompletePackCovers("Bleach.TYBW.S01-S03.COMPLETE.1080p", targets), true);
  assert.equal(bleachCompletePackCovers("Bleach.S01-S16.COMPLETE.1080p", targets), false);
  assert.equal(bleachCompletePackCovers("Bleach.TYBW.S02.COMPLETE", targets), false);
  assert.deepEqual(bleachReleaseTargets([{ season: 17, episode: 14 }], "Bleach.TYBW.S02.COMPLETE")[0], {
    season: 2, episode: 1, library: { season: 17, episode: 14 },
  });
});

test("both fiches can acquire before Plex exists and retain independent ratings, watchlist and preferences", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-bleach-parity-"));
  const previous = process.env.MOVVIZ_CONFIG_DIR;
  const previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = directory;
  try {
    const store = await import("@/lib/library/store");
    const cache = await import("@/lib/fsJsonCache");
    const { prepareBleachGrab } = await import("@/lib/library/bleachEngine");
    const { addWatchlistItem, loadWatchlist, removeWatchlistItem } = await import("@/lib/watchlist/store");
    const { setRating, getRating, clearRating } = await import("@/lib/ai/tasteProfile");
    const { scopedBleachSeries } = await import("@/lib/library/bleachScope");
    const base = canonicalCatalogue();
    const series = { ...base, id: "sr_parity", title: "Bleach", originalTitle: "BLEACH", year: 2004, plexRatingKey: null,
      qualityProfileId: "hd-1080p", bleachSettings: { tybw: { qualityProfileId: "uhd-4k" } },
      seasons: base.seasons.map(s => ({ ...s, monitored: false, episodes: s.episodes.map(e => ({ ...e, seasonNumber: s.seasonNumber, title: "episode", monitored: false, status: "available", file: null, activeInfoHash: null })) })),
    } as unknown as LibrarySeries;
    store.addSeries(series);
    globalThis.fetch = async () => Response.json({ capabilities: { episodePlacementV1: true, episodePresentationV1: true } });
    const original = await prepareBleachGrab("episode:sr_parity:16:24", "Bleach.S16E24.1080p");
    const sequel = await prepareBleachGrab("episode:sr_parity:17:14", "Bleach.TYBW.S02E01.1080p");
    assert.deepEqual(original.single?.placement, { season: 16, episode: 24 });
    assert.deepEqual(sequel.single?.placement, { season: 2, episode: 1 });
    assert.notEqual(original.single?.presentation?.folder, sequel.single?.presentation?.folder);
    assert.equal(scopedBleachSeries(series, "tybw").qualityProfileId, "uhd-4k");
    assert.equal(scopedBleachSeries(series, "original").qualityProfileId, "hd-1080p");
    const auth = await import("@/lib/auth/store");
    const { NextRequest } = await import("next/server");
    auth.addUser({ id: "fixture-admin", username: "fixture-admin", role: "admin", status: "approved", createdAt: Date.now(),
      passwordHash: null, autoApproveRequests: true, autoRequestFromWatchlist: false, discoverContinents: [],
      requestLimitMovies: null, requestLimitSeries: null, canManageRequests: true,
      plexId: null, plexToken: null, plexManagedUserId: null, plexAvatar: null, customAvatar: null,
    });
    const session = auth.createSession("fixture-admin");
    const headers = { cookie: `movviz_session=${session.token}`, "content-type": "application/json" };
    const grabRoute = await import("../src/app/api/indexers/grab/route");
    const accepted: Record<string, unknown>[] = [];
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith("/health")) return Response.json({ capabilities: { episodePlacementV1: true, episodePresentationV1: true } });
      if (String(input).endsWith("/torrents")) {
        accepted.push(JSON.parse(String(init?.body)));
        return Response.json({ infoHash: `fixture-${accepted.length}`, name: "fixture" });
      }
      throw new Error(`Unexpected request in isolated fixture`);
    };
    for (const [part, season, release, cour] of [
      ["original", 2, "Bleach.S02.COMPLETE.1080p", undefined],
      ["tybw", 17, "Bleach.TYBW.S02.COMPLETE.1080p", 2],
    ] as const) {
      const response = await grabRoute.POST(new NextRequest("http://localhost/api/indexers/grab", { method: "POST", headers,
        body: JSON.stringify({ libraryRef: `season:sr_parity:${season}`, seriesPart: part, bleachPart: cour, releaseTitle: release, title: "Bleach", magnetUrl: "magnet:?xt=urn:btih:0000000000000000000000000000000000000001" }),
      }));
      assert.equal(response.status, 200, JSON.stringify(await response.json()));
    }
    assert.equal((accepted[0].episodeTargets as unknown[]).length, 21);
    assert.equal((accepted[1].episodeTargets as unknown[]).length, 13);
    const itemRoute = await import("../src/app/api/library/series/[id]/route");
    const params = { params: Promise.resolve({ id: "sr_parity" }) };
    const patched = await itemRoute.PATCH(new NextRequest("http://localhost/api/library/series/sr_parity", { method: "PATCH", headers, body: JSON.stringify({ seriesPart: "original", qualityProfileId: "original-only", aliases: ["Original Bleach"] }) }), params);
    assert.equal(patched.status, 200);
    assert.equal(scopedBleachSeries(store.getSeries("sr_parity")!, "original").qualityProfileId, "original-only");
    assert.equal(scopedBleachSeries(store.getSeries("sr_parity")!, "tybw").qualityProfileId, "uhd-4k");
    const removed = await itemRoute.DELETE(new NextRequest("http://localhost/api/library/series/sr_parity?seriesPart=tybw", { method: "DELETE", headers }), params);
    assert.equal(removed.status, 200);
    assert.deepEqual(store.getSeries("sr_parity")!.seasons.map(s => s.seasonNumber), Array.from({ length: 16 }, (_, i) => i + 1));
    assert.equal(needsBleachRepair(store.getSeries("sr_parity")!), false);
    for (const seriesPart of ["original", "tybw"] as const) {
      addWatchlistItem({ userId: "viewer", type: "series", tmdbId: 30984, seriesPart, title: seriesPart, year: 2004, posterPath: null, rating: 0, addedAt: Date.now() });
      setRating("viewer", { tmdbId: 30984, type: "series", seriesPart, title: seriesPart, rating: seriesPart === "original" ? 5 : 3, source: "explicit", confidence: 1 });
    }
    assert.equal(loadWatchlist("viewer").length, 2);
    assert.equal(getRating("viewer", 30984, "series", "original")?.rating, 5);
    assert.equal(getRating("viewer", 30984, "series", "tybw")?.rating, 3);
    removeWatchlistItem("viewer", "series", 30984, undefined, undefined, Date.now() + 1, "tybw");
    clearRating("viewer", 30984, "series", Date.now() + 1, "movviz", "tybw");
    assert.equal(loadWatchlist("viewer")[0]?.seriesPart, "original");
    assert.equal(loadWatchlist("viewer").length, 1);
    assert.equal(getRating("viewer", 30984, "series", "original")?.rating, 5);
    assert.equal(getRating("viewer", 30984, "series", "tybw"), null);
    cache.flushPendingJsonWritesSync();
  } finally {
    globalThis.fetch = previousFetch;
    if (previous == null) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previous;
    // Retain the isolated fixture for diagnosis; never recursively delete a computed path.
  }
});
