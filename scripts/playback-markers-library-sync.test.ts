import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import des stores : jamais les vraies données.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-introdb-library-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const settings = await import("../src/lib/settings/markerSources.ts");
const store = await import("../src/lib/playback/markers/store.ts");
const sync = await import("../src/lib/playback/markers/librarySync.ts");
const syncState = await import("../src/lib/playback/markers/librarySyncState.ts");
const { savePlexConfig, loadPlexConfig } = await import("../src/lib/plex/store.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

after(() => {
  flushPendingJsonWritesSync();
  fs.rmSync(config, { recursive: true, force: true });
});

const realFetch = globalThis.fetch;
let calls: string[] = [];
function fakeApi(body: unknown, status = 200) {
  calls = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}
after(() => { globalThis.fetch = realFetch; });

const movie = (n: number) => ({ key: `mv_${n}`, api: { kind: "movie" as const, tmdbId: 1000 + n } });
const seven = [1, 2, 3, 4, 5, 6, 7].map(movie);

test("« Plex uniquement » : la synchronisation de la bibliothèque ne fait aucune requête", async () => {
  savePlexConfig({ ...loadPlexConfig(), hostname: "plex.local", adminToken: "x" });
  settings.setMarkerSourceMode("plex-only");
  fakeApi({});
  const result = await sync.syncIntroDbLibrary("full", { targets: seven });
  assert.equal(result.skipped, "disabled");
  assert.equal(calls.length, 0);
});

test("les trois modes : qui fournit les repères, et quelles tâches tournent", () => {
  settings.setMarkerSourceMode("plex-only");
  assert.deepEqual([settings.plexMarkersEnabled(), settings.externalMarkersEnabled()], [true, false]);
  assert.deepEqual([...settings.markerSourcePriority()], ["plex"]);
  settings.setMarkerSourceMode("all");
  assert.deepEqual([settings.plexMarkersEnabled(), settings.externalMarkersEnabled()], [true, true]);
  assert.deepEqual([...settings.markerSourcePriority()], ["plex", "theintrodb"]);
  settings.setMarkerSourceMode("api-only");
  // Plex désactivé : sa tâche planifiée doit être en pause, TheIntroDB seul alimente la lecture.
  assert.deepEqual([settings.plexMarkersEnabled(), settings.externalMarkersEnabled()], [false, true]);
  assert.deepEqual([...settings.markerSourcePriority()], ["theintrodb"]);
});

test("le mode nouveautés attend la fin de la première passe de nuit", async () => {
  settings.setMarkerSourceMode("api-only");
  fakeApi({});
  const early = await sync.syncIntroDbLibrary("new", { targets: seven });
  assert.equal(early.skipped, "waiting_first_pass");
  assert.equal(calls.length, 0);
});

test("la passe de nuit est plafonnée, reprend où elle s'est arrêtée, puis passe le relais aux nouveautés", async () => {
  fakeApi({ intro: [{ start_ms: 1_000, end_ms: 60_000 }] });
  const first = await sync.syncIntroDbLibrary("full", { targets: seven, limit: 3 });
  assert.deepEqual([first.candidates, first.attempted, first.remaining], [7, 3, 4]);
  assert.equal(calls.length, 3);
  assert.equal(syncState.loadIntroDbSyncState().firstPassDone, false);

  // Le lendemain : seuls les 4 titres jamais interrogés restent, aucune requête refaite.
  fakeApi({ intro: [{ start_ms: 1_000, end_ms: 60_000 }] });
  const second = await sync.syncIntroDbLibrary("full", { targets: seven, limit: 10 });
  assert.deepEqual([second.candidates, second.attempted, second.remaining], [4, 4, 0]);
  assert.equal(syncState.loadIntroDbSyncState().firstPassDone, true);
  assert.ok(seven.every((t) => store.getSourceState(t.key, "theintrodb")));

  // Un titre ajouté ensuite est repris par le mode nouveautés, et lui seul.
  fakeApi({ credits: [{ start_ms: 5_000_000, end_ms: null }] });
  const added = movie(8);
  const recent = await sync.syncIntroDbLibrary("new", { targets: [...seven, added] });
  assert.deepEqual([recent.candidates, recent.attempted], [1, 1]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /tmdb_id=1008/);
  assert.deepEqual(store.getPlaybackMarkers("mv_8").map((m) => m.type), ["credits"]);
});

test("une limite d'API (429) arrête la passe sans rien écrire pour les titres restants", async () => {
  fakeApi({ error: "slow", retry_after: 120 }, 429);
  const batch = [21, 22, 23, 24].map(movie);
  const result = await sync.syncIntroDbLibrary("full", { targets: batch, limit: 10 });
  assert.equal(result.skipped, "rate_limited");
  assert.equal(calls.length, 1);
  assert.ok(batch.every((t) => store.getSourceState(t.key, "theintrodb") === null));
});
