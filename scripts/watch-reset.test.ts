import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { User } from "../src/lib/auth/types.ts";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-watch-reset-"));
const { getUserContextHealth } = await import("../src/lib/userContext/database.ts");
const { applyWatchDecision, getCanonicalWatchStatus, getCurrentWatchState } = await import("../src/lib/userContext/watchBridge.ts");
const { setWatchedMovies, setWatchedEpisodes, getWatchStatus, recordWatched } = await import("../src/lib/plex/watchStore.ts");
const { getUserWatchHistory } = await import("../src/lib/userContext/history.ts");
const { openPlaybackSession, applyHeartbeat, listAllPlaybackProgress } = await import("../src/lib/playback/progressStore.ts");
const { startWatchReset, getWatchResetStatus } = await import("../src/lib/watch/watchReset.ts");

function fakeUser(id: string): User {
  return { id, username: id, role: "user", status: "approved" } as unknown as User;
}

function seed(userId: string, at: number) {
  setWatchedMovies(userId, [101], true, "Film", at, "plex_history");
  setWatchedEpisodes(userId, [{ tmdbId: 202, season: 1, episode: 1, watchedAt: at }], true, "Série", "plex_history");
  const { session } = openPlaybackSession(userId, { ratingKey: `rk-${userId}`, mediaType: "movie", durationMs: 7_200_000, tmdbId: 303, title: "En cours" });
  applyHeartbeat(session.id, { sequence: 1, positionMs: 600_000, isPlaying: true });
}

test("Effacer la lecture remet un seul profil à zéro et bloque le retour des anciennes vues", async (t) => {
  const sqlite = getUserContextHealth().database === "ok";
  const me = `reset-me-${Date.now()}`;
  const other = `reset-other-${Date.now()}`;
  const past = Date.now() - 86_400_000;
  seed(me, past);
  seed(other, past);

  const result = startWatchReset(fakeUser(me));
  await result.done;

  // Ce profil : plus rien de vu, plus de reprise, plus d'historique.
  assert.deepEqual(getWatchStatus(me)?.movies ?? [], []);
  assert.deepEqual(getWatchStatus(me)?.episodes ?? [], []);
  assert.deepEqual(getWatchStatus(me)?.recent ?? [], []);
  assert.equal(listAllPlaybackProgress(me).length, 0);
  assert.equal(getUserWatchHistory({ userId: me }).length, 0);
  if (sqlite) {
    const canonical = getCanonicalWatchStatus(me);
    assert.deepEqual(canonical?.movies ?? [], []);
    assert.deepEqual(canonical?.episodes ?? [], []);
    assert.equal(getCurrentWatchState({ userId: me, tmdbId: 101, mediaType: "movie" }), "unwatched");
  }
  // Plex non configuré ici : rien n'est touché côté Plex, et c'est dit.
  assert.equal(getWatchResetStatus(me)?.plex?.state, "skipped");

  // L'autre profil n'a rien perdu.
  assert.ok(getWatchStatus(other)?.movies.includes(101));
  assert.equal(getWatchStatus(other)?.episodes.length, 1);
  assert.equal(listAllPlaybackProgress(other).length, 1);
  if (sqlite) {
    assert.ok(getCanonicalWatchStatus(other)?.movies.includes(101));
    assert.ok(getUserWatchHistory({ userId: other }).length > 0);
  } else {
    t.diagnostic("node:sqlite indisponible : partie canonique non vérifiée");
  }

  // Une resynchro Plex de l'ancien historique ne fait rien revenir.
  const replay = applyWatchDecision({ userId: me, tmdbId: 101, mediaType: "movie", state: "watched", occurredAt: past, source: "plex_history" });
  assert.equal(replay.accepted, false);
  setWatchedMovies(me, [404], true, "Autre", past, "plex_history");
  recordWatched(me, { tmdbId: 404, type: "movie", title: "Autre", at: past });
  assert.deepEqual(getWatchStatus(me)?.movies ?? [], []);
  assert.deepEqual(getWatchStatus(me)?.recent ?? [], []);
  assert.equal(getUserWatchHistory({ userId: me }).length, 0);

  // Une vraie vue après l'effacement compte normalement.
  setWatchedMovies(me, [505], true, "Nouveau", Date.now() + 1000, "movviz_manual");
  assert.ok(getWatchStatus(me)?.movies.includes(505));

  // Un import Netflix relancé exprès reste accepté, même avec des dates anciennes.
  setWatchedMovies(me, [606], true, "Import", past, "external_import");
  assert.ok(getWatchStatus(me)?.movies.includes(606));
});

test("Effacer la lecture refuse un 2e effacement simultané du même profil", async () => {
  const me = `reset-twice-${Date.now()}`;
  const first = startWatchReset(fakeUser(me));
  assert.throws(() => startWatchReset(fakeUser(me)), /already_running/);
  await first.done;
});
