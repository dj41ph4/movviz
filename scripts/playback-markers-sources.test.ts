import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import des stores : jamais les vraies données.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-marker-sources-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const settings = await import("../src/lib/settings/markerSources.ts");
const store = await import("../src/lib/playback/markers/store.ts");
const external = await import("../src/lib/playback/markers/externalSync.ts");
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

const plexMarker = { id: "intro-1-2", source: "plex" as const, sourceMarkerId: null, type: "intro" as const, startMs: 60_000, endMs: 90_000, final: false };

test("sans Plex lié, le mode effectif est « API uniquement » quoi qu'on ait choisi", () => {
  assert.equal(settings.getMarkerSourceMode(), "plex-only");
  assert.equal(settings.effectiveMarkerSourceMode(), "api-only");
  settings.setMarkerSourceMode("plex-only");
  assert.equal(settings.effectiveMarkerSourceMode(), "api-only");
});

test("avec Plex lié, « Plex uniquement » est le défaut et masque la source externe sans l'effacer", async () => {
  savePlexConfig({ ...loadPlexConfig(), hostname: "plex.local", adminToken: "x" });
  assert.equal(settings.effectiveMarkerSourceMode(), "plex-only");

  // Plex uniquement : aucune requête sortante.
  fakeApi({ recap: [{ start_ms: null, end_ms: 30_000 }] });
  await external.ensureExternalMarkers({ key: "m1", api: { kind: "movie", tmdbId: 603 } });
  assert.equal(calls.length, 0);

  settings.setMarkerSourceMode("all");
  assert.equal(settings.effectiveMarkerSourceMode(), "all");
  store.replaceSourceMarkers("ep:s1e1", "plex", [plexMarker], { signature: "p", sourceUpdatedAt: null, lastSyncedAt: 1 });

  fakeApi({
    recap: [{ start_ms: null, end_ms: 30_000 }],
    intro: [{ start_ms: 61_000, end_ms: 91_000 }],
    credits: [{ start_ms: 2_400_000, end_ms: null }],
  });
  await external.ensureExternalMarkers({ key: "ep:s1e1", api: { kind: "episode", tmdbId: 1396, season: 1, episode: 1 } });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.theintrodb\.org\/v4\/media\?tmdb_id=1396&season=1&episode=1/);

  // Plex gagne sur l'intro, l'externe fournit récap et générique.
  assert.deepEqual(
    store.getPlaybackMarkers("ep:s1e1").map((m) => `${m.source}:${m.type}`),
    ["theintrodb:recap", "plex:intro", "theintrodb:credits"],
  );

  // Déjà synchronisé récemment : pas de seconde requête.
  await external.ensureExternalMarkers({ key: "ep:s1e1", api: { kind: "episode", tmdbId: 1396, season: 1, episode: 1 } });
  assert.equal(calls.length, 1);

  // Retour à « Plex uniquement » : les repères externes sont masqués, pas supprimés.
  settings.setMarkerSourceMode("plex-only");
  assert.deepEqual(store.getPlaybackMarkers("ep:s1e1").map((m) => m.source), ["plex"]);
  settings.setMarkerSourceMode("all");
  assert.equal(store.getPlaybackMarkers("ep:s1e1").length, 3);
});

test("une sync Plex à zéro marqueur n'efface pas ceux de la source externe", () => {
  store.replaceSourceMarkers("ep:s1e1", "plex", [], { signature: "", sourceUpdatedAt: null, lastSyncedAt: 2 });
  // L'intro de la source externe, masquée tant que Plex avait la sienne, prend le relais.
  assert.deepEqual(
    store.getPlaybackMarkers("ep:s1e1").map((m) => `${m.source}:${m.type}`),
    ["theintrodb:recap", "theintrodb:intro", "theintrodb:credits"],
  );
});

test("une panne de l'API n'écrit rien (panne ≠ aucun repère) et n'est pas réessayée aussitôt", async () => {
  fakeApi({ error: "boom" }, 500);
  await external.ensureExternalMarkers({ key: "m2", api: { kind: "movie", tmdbId: 27205 } });
  assert.equal(calls.length, 1);
  assert.equal(store.getMarkerRecord("m2"), null);
  await external.ensureExternalMarkers({ key: "m2", api: { kind: "movie", tmdbId: 27205 } });
  assert.equal(calls.length, 1);
});

test("un titre inconnu de l'API est mémorisé comme vide et n'est pas redemandé", async () => {
  fakeApi({ error: "none", code: "no_submissions" }, 404);
  await external.ensureExternalMarkers({ key: "m3", api: { kind: "movie", tmdbId: 11 } });
  assert.equal(calls.length, 1);
  assert.deepEqual(store.getPlaybackMarkers("m3"), []);
  assert.ok(store.getSourceState("m3", "theintrodb"));
  await external.ensureExternalMarkers({ key: "m3", api: { kind: "movie", tmdbId: 11 } });
  assert.equal(calls.length, 1);
});
