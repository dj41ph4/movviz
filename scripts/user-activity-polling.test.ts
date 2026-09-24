import { test } from "node:test";
import assert from "node:assert/strict";
import { isUserInteraction } from "@/lib/priority/userActivity";

/**
 * Les boucles de rafraîchissement des apps Android (fiche ouverte : entrée
 * bibliothèque, saisons ; lecteur : heartbeat) maintenaient l'utilisateur
 * « actif » en permanence et bridaient l'arrière-plan pendant des heures.
 * Un GET identique répété est désormais du polling ; la première ouverture
 * reste une vraie interaction.
 */

test("première ouverture d'une fiche = interaction, sa répétition automatique = polling", () => {
  const user = `usr_poll_${Date.now()}`;
  assert.equal(isUserInteraction("/api/library/movies", "GET", "?tmdbId=550", user), true);
  assert.equal(isUserInteraction("/api/library/movies", "GET", "?tmdbId=550", user), false);
  assert.equal(isUserInteraction("/api/library/series/ser_1", "GET", "", user), true);
  assert.equal(isUserInteraction("/api/library/series/ser_1", "GET", "", user), false);
});

test("naviguer vers un autre titre reste une interaction", () => {
  const user = `usr_nav_${Date.now()}`;
  assert.equal(isUserInteraction("/api/metadata/detail", "GET", "?type=movie&tmdbId=550", user), true);
  assert.equal(isUserInteraction("/api/metadata/detail", "GET", "?type=movie&tmdbId=680", user), true);
});

test("la même URL chez un autre utilisateur n'est pas une répétition", () => {
  const stamp = Date.now();
  assert.equal(isUserInteraction("/api/interface/dashboard", "GET", "", `usr_a_${stamp}`), true);
  assert.equal(isUserInteraction("/api/interface/dashboard", "GET", "", `usr_b_${stamp}`), true);
});

test("heartbeat du lecteur Android = silencieux, seek/stop = vraies actions", () => {
  assert.equal(isUserInteraction("/api/playback/sessions/abc123/heartbeat", "POST"), false);
  assert.equal(isUserInteraction("/api/playback/sessions/abc123/seek", "POST"), true);
  assert.equal(isUserInteraction("/api/playback/sessions/abc123/stop", "POST"), true);
  assert.equal(isUserInteraction("/api/stream/12345/progress", "POST"), false);
});

test("une répétition hors de la fenêtre de 90 s redevient une interaction", (t) => {
  const user = `usr_window_${Date.now()}`;
  const realNow = Date.now;
  let now = realNow();
  t.mock.method(Date, "now", () => now);
  assert.equal(isUserInteraction("/api/interface/dashboard", "GET", "", user), true);
  now += 5_000;
  assert.equal(isUserInteraction("/api/interface/dashboard", "GET", "", user), false);
  now += 91_000;
  assert.equal(isUserInteraction("/api/interface/dashboard", "GET", "", user), true);
});

test("ancienne signature (sans utilisateur) : comportement inchangé", () => {
  assert.equal(isUserInteraction("/api/library/movies", "GET"), true);
  assert.equal(isUserInteraction("/api/library/movies", "GET"), true);
  assert.equal(isUserInteraction("/api/jobs", "GET"), false);
  assert.equal(isUserInteraction("/api/perf", "POST"), false);
});

test("un poll régulier (toutes les 30 s) reste du polling indéfiniment", (t) => {
  const user = `usr_steady_${Date.now()}`;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  assert.equal(isUserInteraction("/api/plex/on-deck", "GET", "", user), true);
  for (let i = 0; i < 10; i++) {
    now += 30_000;
    assert.equal(isUserInteraction("/api/plex/on-deck", "GET", "", user), false);
  }
});
