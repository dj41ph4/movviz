import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-watched-detection-"));
process.env.MOVVIZ_CONFIG_DIR = tempDir;
process.env.MOVVIZ_DATA_DIR = tempDir;

const { completionBoundaryMs, fallbackRemainingMs, estimateCreditsLengthMs, canComplete } = await import("../src/lib/playback/progressPolicy.ts");
const { openPlaybackSession, applyHeartbeat, applySeek, applyMarkerSkip, completePlayback, stopPlayback, getPlaybackProgress, updatePlaybackDuration, clearPlaybackProgress } =
  await import("../src/lib/playback/progressStore.ts");
const { replaceSourceMarkers } = await import("../src/lib/playback/markers/store.ts");
const { applyWatchDecision } = await import("../src/lib/userContext/watchBridge.ts");
const { setWatchedMovies, getWatchStatus } = await import("../src/lib/plex/watchStore.ts");

const MIN = 60_000;
type Session = { id: string; startedAt: number };
const clocks = new Map<string, { now: number; seq: number }>();
/** Real playback from one position to another, one heartbeat every 10 s. */
function play(session: Session, fromMs: number, toMs: number) {
  const c = clocks.get(session.id) ?? { now: session.startedAt, seq: 0 };
  clocks.set(session.id, c);
  let last = null;
  for (let pos = fromMs + 10_000; pos <= toMs; pos += 10_000) {
    c.now += 10_000;
    last = applyHeartbeat(session.id, { sequence: ++c.seq, positionMs: pos, isPlaying: true, nowMs: c.now });
  }
  return last!;
}
let n = 0;
function open(mediaType: "movie" | "episode", durationMs: number, extra: Record<string, unknown> = {}) {
  const key = `k${++n}`;
  const userId = `u${n}`;
  const { session } = openPlaybackSession(userId, { ratingKey: key, mediaId: `m${n}`, mediaType, durationMs, ...extra });
  return { session, userId, key, mediaId: `m${n}` };
}

test("T = 3 % de la durée, borné entre 30 s et 90 s", () => {
  assert.equal(fallbackRemainingMs(10 * MIN), 30_000);
  assert.equal(fallbackRemainingMs(20 * MIN), 36_000);
  assert.equal(fallbackRemainingMs(45 * MIN), 81_000);
  assert.equal(fallbackRemainingMs(180 * MIN), 90_000);
  assert.equal(completionBoundaryMs(180 * MIN, [], "movie").boundaryMs, 180 * MIN - 90_000);
  assert.equal(completionBoundaryMs(20 * MIN, [], "episode").boundaryMs, 20 * MIN - 36_000);
});

test("un marqueur de générique de fin prime, pour un film comme pour un épisode ; un générique d'ouverture est ignoré", () => {
  const credits = [{ type: "credits", startMs: 40 * MIN, endMs: 44 * MIN, final: true }];
  assert.deepEqual(completionBoundaryMs(44 * MIN, credits, "episode"), { boundaryMs: 40 * MIN, source: "plex_final_credits" });
  assert.equal(completionBoundaryMs(44 * MIN, [{ type: "credits", startMs: MIN, endMs: 2 * MIN }], "episode").source, "fallback");
});

test("estimation par les autres épisodes : seulement si les données sont cohérentes", () => {
  assert.equal(estimateCreditsLengthMs([120_000, 125_000]), null, "trop peu d'épisodes");
  assert.equal(estimateCreditsLengthMs([120_000, 60_000, 125_000]), null, "incohérent");
  assert.equal(estimateCreditsLengthMs([120_000, 122_000, 125_000]), 122_000);
  assert.deepEqual(completionBoundaryMs(44 * MIN, [], "episode", 122_000), { boundaryMs: 44 * MIN - 122_000, source: "estimated" });
  assert.equal(completionBoundaryMs(120 * MIN, [], "movie", 122_000).source, "fallback", "jamais pour un film");
});

test("film long : 90 % ne suffit plus, il faut arriver à 90 s de la fin", () => {
  const { session } = open("movie", 180 * MIN);
  const at90 = play(session, 0, 162 * MIN);
  assert.equal(at90.watched, false, "il reste 18 minutes");
  assert.equal(at90.resumeOffsetMs, 162 * MIN);
  const nearEnd = play(session, 162 * MIN, 180 * MIN - 90_000);
  assert.equal(nearEnd.watched, true);
  assert.equal(nearEnd.resumeOffsetMs, null);
});

test("épisode spécial long sans marqueur : même règle, pas de validation prématurée", () => {
  const { session } = open("episode", 95 * MIN);
  assert.equal(play(session, 0, 80 * MIN).watched, false, "84 % : l'ancien seuil de 80 % l'aurait validé");
  assert.equal(play(session, 80 * MIN, 95 * MIN - 90_000).watched, true);
});

test("saut manuel vers la fin : ni le seuil, ni l'arrêt, ni la fin de lecture ne marquent vu", () => {
  const { session } = open("movie", 120 * MIN);
  play(session, 0, 2 * MIN);
  applySeek(session.id, 119 * MIN);
  assert.equal(play(session, 119 * MIN, 120 * MIN - 10_000).watched, false);
  assert.equal(completePlayback(session.id).watched, false, "fin atteinte après un saut");
  assert.equal(stopPlayback(session.id, 120 * MIN).watched, false);
});

test("saut non signalé par le lecteur (détecté au battement) : même protection", () => {
  const { session } = open("episode", 40 * MIN);
  play(session, 0, 2 * MIN);
  const c = clocks.get(session.id)!;
  c.now += 10_000;
  applyHeartbeat(session.id, { sequence: ++c.seq, positionMs: 39 * MIN, isPlaying: true, nowMs: c.now });
  play(session, 39 * MIN, 40 * MIN - 10_000);
  assert.equal(completePlayback(session.id).watched, false);
});

test("revenir en arrière après un saut puis tout regarder : vu normalement", () => {
  const { session } = open("episode", 20 * MIN);
  play(session, 0, MIN);
  applySeek(session.id, 19 * MIN + 30_000);
  applySeek(session.id, MIN);
  assert.equal(play(session, MIN, 20 * MIN - 30_000).watched, true);
});

test("fin naturelle : reprise au milieu puis lecture jusqu'au bout", () => {
  const { session } = open("movie", 100 * MIN);
  applySeek(session.id, 70 * MIN);
  const p = play(session, 70 * MIN, 100 * MIN - 10_000);
  assert.equal(p.watched, false, "30 % réellement vus : le seuil automatique ne suffit pas");
  assert.equal(completePlayback(session.id).watched, true, "mais la lecture est arrivée à la fin");
});

test("actions explicites : épisode suivant et « Passer le générique » marquent vu immédiatement", () => {
  const viaStop = open("episode", 40 * MIN);
  play(viaStop.session, 0, 5 * MIN);
  assert.equal(stopPlayback(viaStop.session.id, 5 * MIN, "next_episode").watched, true);

  const viaEnded = open("episode", 40 * MIN);
  play(viaEnded.session, 0, 5 * MIN);
  assert.equal(completePlayback(viaEnded.session.id, "next_episode").watched, true);

  const film = open("movie", 120 * MIN);
  play(film.session, 0, 5 * MIN);
  assert.equal(applyMarkerSkip(film.session.id, 120 * MIN, "credits").watched, true, "film : passer le générique = vu");

  const intro = open("episode", 40 * MIN);
  assert.equal(applyMarkerSkip(intro.session.id, 90_000, "intro").watched, false, "passer l'intro ne marque rien");
});

test("synchronisation tardive des marqueurs : la limite suit, un contenu déjà vu reste vu", () => {
  const { session, userId, key, mediaId } = open("episode", 44 * MIN);
  play(session, 0, 41 * MIN);
  assert.equal(getPlaybackProgress(userId, key, mediaId)?.watched, false, "sans marqueur : il reste 3 min");
  replaceSourceMarkers(mediaId, "theintrodb", [{ id: "c", source: "theintrodb", sourceMarkerId: null, type: "credits", startMs: 40 * MIN, endMs: 44 * MIN, final: true }], { signature: "x", sourceUpdatedAt: null, lastSyncedAt: Date.now() });
  assert.equal(updatePlaybackDuration(session.id, 44 * MIN)?.completionBoundaryMs, 40 * MIN);
  assert.equal(play(session, 41 * MIN, 41 * MIN + 10_000).watched, true, "le générique est déjà atteint");
  // Des marqueurs corrigés plus tard ne retirent jamais le statut.
  replaceSourceMarkers(mediaId, "theintrodb", [{ id: "c", source: "theintrodb", sourceMarkerId: null, type: "credits", startMs: 43 * MIN, endMs: 44 * MIN, final: true }], { signature: "y", sourceUpdatedAt: null, lastSyncedAt: Date.now() });
  updatePlaybackDuration(session.id, 44 * MIN);
  assert.equal(getPlaybackProgress(userId, key, mediaId)?.watched, true);
});

test("changement de lecteur : ce qui a été vu sur un appareil compte sur l'autre", () => {
  const first = open("movie", 100 * MIN);
  play(first.session, 0, 60 * MIN);
  stopPlayback(first.session.id, 60 * MIN);
  const { session } = openPlaybackSession(first.userId, { ratingKey: first.key, mediaId: first.mediaId, mediaType: "movie", durationMs: 100 * MIN, webClient: false });
  assert.equal(play(session, 60 * MIN, 100 * MIN - 90_000).watched, true);
});

test("relecture et remise à zéro : un contenu vu reste vu", () => {
  const { session, userId, key, mediaId } = open("episode", 20 * MIN);
  play(session, 0, 20 * MIN - 30_000);
  assert.equal(stopPlayback(session.id, 20 * MIN - 30_000).watched, true);
  const again = openPlaybackSession(userId, { ratingKey: key, mediaId, mediaType: "episode", durationMs: 20 * MIN }).session;
  applySeek(again.id, 0);
  play(again, 0, 3 * MIN);
  assert.equal(stopPlayback(again.id, 3 * MIN).watched, true, "relancé depuis le début puis quitté");
  assert.equal(clearPlaybackProgress(userId, key, mediaId)?.watched, true, "progression effacée, statut intact");
});

test("seule une action explicite retire « Vu » : aucune source automatique", () => {
  const base = { userId: "guard", tmdbId: 603, mediaType: "movie" as const, occurredAt: Date.now() + 1_000 };
  for (const source of ["plex_history", "movviz_playback", "external_import", "legacy_migration"] as const) {
    assert.equal(applyWatchDecision({ ...base, state: "unwatched", source }).accepted, false, source);
  }
  assert.equal(applyWatchDecision({ ...base, tmdbId: 604, state: "unwatched", source: "plex_history", explicitUserAction: true }).accepted, true, "démarqué dans Plex par l'utilisateur : bidirectionnel");
  assert.equal(setWatchedMovies("guard", [603], true, "Matrix"), true);
  setWatchedMovies("guard", [603], false, "Matrix", Date.now() + 5_000, "plex_history");
  assert.ok(getWatchStatus("guard")?.movies.includes(603), "une réparation d'état Plex ne retire pas le statut");
  setWatchedMovies("guard", [603], false, "Matrix", Date.now() + 6_000, "plex_history", true);
  assert.equal(getWatchStatus("guard")?.movies.includes(603), false, "démarqué dans Plex : retiré dans Movviz");
  setWatchedMovies("guard", [603], true, "Matrix", Date.now() + 8_000);
  setWatchedMovies("guard", [603], false, "Matrix", Date.now() + 10_000);
  assert.equal(getWatchStatus("guard")?.movies.includes(603), false, "« Marquer comme non vu » le retire");
});

test("canComplete : position ET 40 % réellement vus", () => {
  const d = 100 * MIN, b = d - 90_000;
  assert.equal(canComplete(39 * MIN, b, b, d, "fallback"), false);
  assert.equal(canComplete(40 * MIN, b, b, d, "fallback"), true);
  assert.equal(canComplete(40 * MIN, b - 1, b, d, "fallback"), false);
});

test("épisode d'anime : récap et intro passés, quitté pendant le générique → vu", () => {
  // 24 min, générique de fin à 22 min. Récap (2 min) et intro (1 min 30) passés,
  // deux sauts de 10 s : moins de 85 % du contenu lu, bien plus de 40 %.
  const { session, mediaId } = open("episode", 24 * MIN);
  replaceSourceMarkers(mediaId, "theintrodb", [{ id: "c", source: "theintrodb", sourceMarkerId: null, type: "credits", startMs: 22 * MIN, endMs: 23 * MIN + 30_000, final: true }], { signature: "a", sourceUpdatedAt: null, lastSyncedAt: Date.now() });
  assert.equal(updatePlaybackDuration(session.id, 24 * MIN)?.completionBoundaryMs, 22 * MIN);
  applySeek(session.id, 2 * MIN);
  play(session, 2 * MIN, 3 * MIN);
  applySeek(session.id, 4 * MIN + 30_000);
  play(session, 4 * MIN + 30_000, 12 * MIN);
  applySeek(session.id, 12 * MIN + 10_000);
  play(session, 12 * MIN + 10_000, 18 * MIN);
  applySeek(session.id, 18 * MIN + 10_000);
  const p = play(session, 18 * MIN + 10_000, 22 * MIN + 10_000);
  assert.equal(p.watched, true);
});

test.after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 350));
  try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); } catch { /* disposable */ }
});
