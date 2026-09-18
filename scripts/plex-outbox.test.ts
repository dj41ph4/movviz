import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { getUserMediaSyncStates, getPendingSyncStates, updateUserMediaSyncState } from "@/lib/userContext/syncState";
import { setWatchedMovies, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { shouldPropagateWatchedToPlex, retryPendingPlexWatchedState } from "@/lib/plex/watchWrite";

function freshUserId(): string {
  return `test-outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function skipIfNoDb(t: { skip: (msg: string) => void }): boolean {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return true;
  }
  return false;
}

test("shouldPropagateWatchedToPlex : les sources locales propagent, plex_history et legacy_migration jamais (§57-59)", () => {
  assert.equal(shouldPropagateWatchedToPlex("movviz_manual"), true);
  assert.equal(shouldPropagateWatchedToPlex("movviz_playback"), true);
  assert.equal(shouldPropagateWatchedToPlex("external_import"), true);
  assert.equal(shouldPropagateWatchedToPlex("ai"), true);
  assert.equal(shouldPropagateWatchedToPlex("plex_history"), false, "sinon boucle Plex -> Movviz -> Plex");
  assert.equal(shouldPropagateWatchedToPlex("legacy_migration"), false);
});

test("setWatchedMovies() avec une source locale crée une entrée PENDING dans l'outbox AVANT toute tentative réseau", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 600_001;
  setWatchedMovies(userId, [tmdbId], true, "Film Test", Date.now(), "movviz_manual");
  const states = getUserMediaSyncStates(userId);
  const entry = states.find((s) => s.stateKey === mediaStateKey(userId, "movie", tmdbId) && s.target === "plex" && s.field === "watched");
  assert.ok(entry, "une entrée outbox doit exister pour cette décision locale");
  assert.equal(entry!.capability, "PENDING");
});

test("setWatchedMovies() avec source=plex_history NE crée PAS d'entrée outbox (pas de boucle)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 600_002;
  setWatchedMovies(userId, [tmdbId], true, "Film Test", Date.now(), "plex_history");
  const states = getUserMediaSyncStates(userId);
  const entry = states.find((s) => s.stateKey === mediaStateKey(userId, "movie", tmdbId) && s.target === "plex" && s.field === "watched");
  assert.equal(entry, undefined, "une décision venant de Plex ne doit jamais redéclencher un export vers Plex");
});

test("setWatchedEpisodes() avec une source locale crée une entrée PENDING par épisode", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 600_003;
  setWatchedEpisodes(userId, [{ tmdbId, season: 1, episode: 1 }], true, "Série Test", "movviz_playback");
  const states = getUserMediaSyncStates(userId);
  const entry = states.find((s) => s.stateKey === mediaStateKey(userId, "episode", tmdbId, 1, 1) && s.target === "plex");
  assert.ok(entry);
  assert.equal(entry!.capability, "PENDING");
});

test("getPendingSyncStates() filtre par target/field/capability et respecte le paramètre 'before' (backoff)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 600_004;
  const stateKey = mediaStateKey(userId, "movie", tmdbId);
  updateUserMediaSyncState({ userId, stateKey, field: "watched", target: "plex", capability: "PENDING", updatedAt: Date.now() });

  // Trop récent pour le backoff choisi (before dans le passé lointain) :
  // ne doit pas apparaître.
  const tooRecent = getPendingSyncStates({ target: "plex", field: "watched", capabilities: ["PENDING"], before: Date.now() - 3_600_000 });
  assert.ok(!tooRecent.some((s) => s.stateKey === stateKey), "une entrée toute fraîche ne doit pas être retentée immédiatement");

  // Sans contrainte de fraîcheur : doit apparaître.
  const anyAge = getPendingSyncStates({ target: "plex", field: "watched", capabilities: ["PENDING"] });
  assert.ok(anyAge.some((s) => s.stateKey === stateKey));

  // Mauvaise capability demandée : ne doit pas apparaître.
  const wrongCapability = getPendingSyncStates({ target: "plex", field: "watched", capabilities: ["SYNCED"] });
  assert.ok(!wrongCapability.some((s) => s.stateKey === stateKey));
});

test("retryPendingPlexWatchedState() ne plante jamais quand Plex n'est pas configuré (filet de sécurité, pas un crash silencieux transformé en pire)", async (t) => {
  if (skipIfNoDb(t)) return;
  // Pas de vrai serveur Plex dans cet environnement de test : la fonction
  // doit sortir proprement (cfg.hostname vide) sans jamais lever. Le vrai
  // scénario de convergence bout-en-bout (§64 : WATCHED, panne Plex,
  // UNWATCHED, panne Plex, Plex revient -> seule la dernière intention
  // compte) est déjà couvert au niveau du resolver par les tests
  // d'applyWatchDecision/getCurrentWatchState — cette fonction n'est qu'un
  // fin wrapper "lire l'état actuel puis pousser", non testable bout-en-
  // bout sans un vrai serveur Plex (voir docs/WATCH_STATE_FINALIZATION.md
  // pour la procédure de test live).
  await assert.doesNotReject(() => retryPendingPlexWatchedState());
});
