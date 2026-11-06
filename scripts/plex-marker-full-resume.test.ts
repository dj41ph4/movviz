import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-marker-full-"));
const { savePlexConfig, loadPlexConfig } = await import("../src/lib/plex/store.ts");
const { addMovie } = await import("../src/lib/library/store.ts");
const { syncPlexMarkers } = await import("../src/lib/plex/markerSync.ts");
const { loadMarkerSyncState } = await import("../src/lib/plex/markerSyncState.ts");

const TOTAL = 130; // 3 lots de 50 (50 + 50 + 30)
const requested: string[][] = [];
let failKeys = new Set<string>();

savePlexConfig({ ...loadPlexConfig(), hostname: "plex.example.com", port: 32400, adminToken: "token", markerSyncEnabled: true });
for (let i = 1; i <= TOTAL; i++) {
  addMovie({
    id: `mv_${i}`, tmdbId: 1000 + i, imdbId: null, title: `Film ${i}`, year: 2020, releaseDate: null, vfReleaseDate: null, overview: "",
    posterPath: null, backdropPath: null, rating: 0, genres: [], monitored: true, qualityProfileId: "any", status: "available",
    file: null, activeInfoHash: null, addedAt: 1, plexRatingKey: String(i),
  } as never);
}

/** Faux serveur Plex : répond aux lots de ratingKeys, avec une intro pour chaque média (sauf ceux à faire échouer). */
globalThis.fetch = (async (input: unknown) => {
  const url = new URL(String(input));
  const match = url.pathname.match(/\/library\/metadata\/([\d,]+)$/);
  if (!match) throw new Error("appel inattendu : " + url);
  const keys = match[1].split(",");
  requested.push(keys);
  const items = keys.filter((k) => !failKeys.has(k)).map((k) => ({ ratingKey: k, Marker: [{ id: k, type: "intro", startTimeOffset: 1000, endTimeOffset: 20000 }] }));
  return new Response(JSON.stringify({ MediaContainer: { Metadata: items } }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

test("une complète interrompue reprend où elle s'était arrêtée, puis se termine et est datée", async () => {
  // Interrompue après le premier lot (redémarrage, arrêt demandé…).
  let batches = 0;
  await syncPlexMarkers({ mode: "full", isCancelled: () => batches++ >= 1 });
  let state = loadMarkerSyncState();
  assert.equal(state.lastFullAt, null, "pas terminée : pas de date");
  assert.ok(state.fullRun, "la reprise est mémorisée");
  assert.equal(requested.length, 1);
  assert.equal(state.fullRun!.lastKey, "50");

  // Reprise : ne retraite pas les 50 premiers, finit les 80 restants.
  requested.length = 0;
  const result = await syncPlexMarkers({ mode: "full" });
  assert.equal(result.mode, "full");
  assert.deepEqual(requested.flat().map(Number).sort((a, b) => a - b)[0], 51, "reprise après le dernier traité");
  assert.equal(requested.flat().length, TOTAL - 50);
  state = loadMarkerSyncState();
  assert.ok(state.lastFullAt && state.lastFullAt > 0, "« dernière complète » est renseignée");
  assert.equal(state.fullRun, null);
});

test("quelques médias en échec n'empêchent plus la complète de se terminer (elle ne fait juste pas la purge globale)", async () => {
  failKeys = new Set(["7", "88"]);
  const state = loadMarkerSyncState();
  state.lastFullAt = null;
  const before = Date.now();
  const result = await syncPlexMarkers({ mode: "full" });
  assert.equal(result.errors, 2);
  const after = loadMarkerSyncState();
  assert.ok(after.lastFullAt && after.lastFullAt >= before, "terminée malgré 2 échecs");
  assert.equal(after.fullRun, null);
  assert.ok(Object.keys(after.dirty).includes("7") && Object.keys(after.dirty).includes("88"), "les échecs repartent en reprise incrémentale");
});
