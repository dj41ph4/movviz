import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeMarkers } from "../src/lib/playback/markers/merge.ts";
import { migrateMarkerStore, type PlaybackMarker } from "../src/lib/playback/markers/types.ts";

function marker(source: PlaybackMarker["source"], type: PlaybackMarker["type"], startMs: number, endMs: number, final = false): PlaybackMarker {
  return { id: `${source}-${type}-${startMs}`, source, sourceMarkerId: null, type, startMs, endMs, final };
}

test("a v1 store migrates to v2 with plex as the only source", () => {
  const migrated = migrateMarkerStore({
    version: 1,
    byRatingKey: {
      "123": {
        ratingKey: "123",
        markers: [
          { id: "credits-900-1000", source: "plex", sourceMarkerId: "9", type: "credits", startMs: 900, endMs: 1000, final: true },
          { id: "intro-10-50", source: "plex", sourceMarkerId: null, type: "intro", startMs: 10, endMs: 50, final: false },
        ],
        signature: "abc",
        plexUpdatedAt: 42,
        lastSyncedAt: 7,
      },
      "456": { ratingKey: "456", markers: [], signature: "", plexUpdatedAt: null, lastSyncedAt: 5 },
    },
  });
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.byKey["123"].markers.map((m) => m.type), ["intro", "credits"]);
  assert.equal(migrated.byKey["123"].sources.plex?.signature, "abc");
  assert.equal(migrated.byKey["123"].sources.plex?.sourceUpdatedAt, 42);
  // Un média déjà répondu par Plex à zéro marqueur reste "déjà synchronisé".
  assert.ok(migrated.byKey["456"].sources.plex);
});

test("a v2 store round-trips and drops corrupt entries", () => {
  const input = {
    version: 2,
    byKey: {
      m1: {
        key: "m1",
        markers: [marker("theintrodb", "recap", 0, 5_000), { type: "intro", startMs: "x", endMs: 1 }, marker("plex", "intro", 6_000, 9_000)],
        sources: { theintrodb: { signature: "s", sourceUpdatedAt: null, lastSyncedAt: 1 }, unknown: { signature: "z" } },
      },
      bad: "nope",
    },
  };
  const migrated = migrateMarkerStore(input);
  assert.deepEqual(Object.keys(migrated.byKey), ["m1"]);
  assert.deepEqual(migrated.byKey["m1"].markers.map((m) => m.type), ["recap", "intro"]);
  assert.deepEqual(Object.keys(migrated.byKey["m1"].sources), ["theintrodb"]);
  assert.deepEqual(migrateMarkerStore(migrated), migrated);
});

test("unknown input yields an empty v2 store", () => {
  assert.deepEqual(migrateMarkerStore(null), { version: 2, byKey: {} });
  assert.deepEqual(migrateMarkerStore({ version: 9 }), { version: 2, byKey: {} });
});

test("plex wins per type and external sources fill the gaps", () => {
  const merged = mergeMarkers([
    marker("plex", "intro", 60_000, 90_000),
    marker("theintrodb", "intro", 58_000, 92_000),
    marker("theintrodb", "recap", 0, 45_000),
    marker("theintrodb", "credits", 2_400_000, 2_500_000),
    marker("theintrodb", "preview", 2_500_000, 2_520_000),
  ]);
  assert.deepEqual(merged.map((m) => `${m.source}:${m.type}`), [
    "theintrodb:recap",
    "plex:intro",
    "theintrodb:credits",
    "theintrodb:preview",
  ]);
});

test("a type is never mixed between two sources and keeps every block of the winner", () => {
  const merged = mergeMarkers([
    marker("plex", "credits", 1_000, 1_200),
    marker("plex", "credits", 5_000, 5_400),
    marker("theintrodb", "credits", 4_900, 5_500),
  ]);
  assert.deepEqual(merged.map((m) => m.id), ["plex-credits-1000", "plex-credits-5000"]);
});

test("priority can exclude a source (plex only)", () => {
  const merged = mergeMarkers(
    [marker("theintrodb", "recap", 0, 1_000), marker("plex", "intro", 2_000, 3_000)],
    ["plex"],
  );
  assert.deepEqual(merged.map((m) => m.type), ["intro"]);
});

test("no marker at all merges to an empty list", () => {
  assert.deepEqual(mergeMarkers([]), []);
});

test("the active marker follows type priority, ignores unknown types", async () => {
  const { pickActiveMarker, markerSkipLabelKey } = await import("../src/lib/playback/markers/active.ts");
  const markers = [
    { type: "preview", startMs: 100, endMs: 500 },
    { type: "credits", startMs: 50, endMs: 600 },
    { type: "commercial", startMs: 0, endMs: 1_000 },
    { type: "intro", startMs: 0, endMs: 40 },
  ];
  assert.equal(pickActiveMarker(markers, 200)?.type, "credits");
  assert.equal(pickActiveMarker(markers, 10)?.type, "intro");
  assert.equal(pickActiveMarker(markers, 700), null);
  assert.equal(markerSkipLabelKey("recap"), "player.skipRecap");
  assert.equal(markerSkipLabelKey("preview"), "player.skipPreview");
});

test("TheIntroDB: open-ended segments, zero segments and unknown fields", async () => {
  const { normalizeTheIntroDb } = await import("../src/lib/playback/markers/theintrodb.ts");
  const markers = normalizeTheIntroDb({
    tvdb_id: 1, type: "tv", season: 1, episode: 2,
    recap: [{ start_ms: null, end_ms: 40_000 }],
    intro: [{ start_ms: 45_000, end_ms: 90_000 }, { start_ms: 0, end_ms: 0 }],
    credits: [{ start_ms: 2_400_000, end_ms: null }],
    preview: [{ start_ms: 2_500_000, end_ms: 2_520_000 }, { start_ms: null, end_ms: null }],
  }, 2_520_000);
  assert.deepEqual(markers.map((m) => `${m.type}:${m.startMs}-${m.endMs}:${m.final}`), [
    "recap:0-40000:false",
    "intro:45000-90000:false",
    "credits:2400000-2520000:true",
    "preview:2500000-2520000:false",
  ]);
  assert.ok(markers.every((m) => m.source === "theintrodb"));
  // Durée inconnue : « jusqu'à la fin » devient la borne maximale de l'API (6 h).
  const noDuration = normalizeTheIntroDb({ credits: [{ start_ms: 1_000, end_ms: null }] });
  assert.equal(noDuration[0].endMs, 21_600_000);
  assert.deepEqual(normalizeTheIntroDb(null), []);
  assert.deepEqual(normalizeTheIntroDb({ intro: "nope" }), []);
});

test("TheIntroDB: a 404 with a known code is empty, an outage is an error", async () => {
  const { fetchTheIntroDb } = await import("../src/lib/playback/markers/theintrodb.ts");
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
  const movie = { kind: "movie", tmdbId: 603 } as const;
  assert.deepEqual(await fetchTheIntroDb(movie, reply(404, { error: "x", code: "no_submissions" })), { ok: true, markers: [] });
  const down = await fetchTheIntroDb(movie, reply(500, { error: "boom" }));
  assert.equal(down.ok, false);
  const limited = await fetchTheIntroDb(movie, reply(429, { error: "slow", retry_after: 30 }));
  assert.deepEqual(limited, { ok: false, error: "rate_limited", retryAfterMs: 30_000 });
  const ok = await fetchTheIntroDb({ kind: "episode", tmdbId: 1399, season: 1, episode: 1, durationMs: 3_000_000 }, (async (url: string) => {
    assert.match(String(url), /tmdb_id=1399&season=1&episode=1&duration_ms=3000000/);
    return new Response(JSON.stringify({ intro: [{ start_ms: 1_000, end_ms: 60_000 }] }), { status: 200 });
  }) as unknown as typeof fetch);
  assert.equal(ok.ok && ok.markers[0].type, "intro");
  const failed = await fetchTheIntroDb(movie, (async () => { throw new Error("offline"); }) as unknown as typeof fetch);
  assert.deepEqual(failed, { ok: false, error: "offline" });
});
