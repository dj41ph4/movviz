import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { applyWatchDecision } from "@/lib/userContext/watchBridge";

let counter = 0;
function freshUserId(): string {
  counter += 1;
  // Math.random() en plus de Date.now() : deux exécutions rapprochées de
  // `npm test` peuvent atteindre ce même appel au même milliseconde près,
  // ce qui recréerait le même sourceEventId synthétisé (userId inclus) et
  // ferait passer un test pour un doublon persistant réel (confirmé en
  // pratique — voir scripts/user-context-ledger.test.ts qui fait déjà ainsi).
  return `test-watchdecision-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`;
}

function skipIfNoDb(t: { skip: (msg: string) => void }): boolean {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return true;
  }
  return false;
}

test("Plex WATCHED @T1 -> WATCHED", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const T1 = 1_000_000;
  const result = applyWatchDecision({ userId, tmdbId: 1, mediaType: "movie", state: "watched", occurredAt: T1, source: "plex_history" });
  assert.equal(result.accepted, true);
  assert.equal(result.previousState, "unknown");
  assert.equal(result.effectiveState, "watched");
});

test("scénario complet du plan (§71) : Plex T1 -> Movviz UNWATCHED T2 -> resync Plex T1 (rejeté) -> nouveau Plex T3 (accepté)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 2;
  const T1 = 1_000_000;
  const T2 = 2_000_000;
  const T3 = 3_000_000;

  const plexInitial = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: T1, source: "plex_history" });
  assert.equal(plexInitial.accepted, true);
  assert.equal(plexInitial.effectiveState, "watched");

  const manualUnwatch = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "unwatched", occurredAt: T2, source: "movviz_manual" });
  assert.equal(manualUnwatch.accepted, true);
  assert.equal(manualUnwatch.effectiveState, "unwatched");

  // Le coeur du bug corrigé par cette refonte : une resynchro Plex qui
  // renvoie encore l'ancien viewedAt=T1 ne doit JAMAIS ressusciter l'état.
  const staleReplay = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: T1, source: "plex_history", sourceEventId: `plex:acc:key:${userId}:${T1}-replay` });
  assert.equal(staleReplay.accepted, false);
  assert.equal(staleReplay.reason, "older_event");
  assert.equal(staleReplay.effectiveState, "unwatched", "l'état ne doit pas repasser à watched");

  // Un vrai nouveau visionnage Plex (T3 > T2) doit en revanche gagner.
  const realRewatch = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: T3, source: "plex_history" });
  assert.equal(realRewatch.accepted, true);
  assert.equal(realRewatch.effectiveState, "watched");
});

test("Movviz WATCHED @T3 -> un vieux Plex @T1 reste sans effet (reste WATCHED @T3)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 3;
  const manual = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: 3_000_000, source: "movviz_manual" });
  assert.equal(manual.accepted, true);
  const oldPlex = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: 1_000_000, source: "plex_history" });
  assert.equal(oldPlex.accepted, false);
  assert.equal(oldPlex.reason, "older_event");
  assert.equal(oldPlex.effectiveState, "watched");
  assert.equal(oldPlex.effectiveUpdatedAt, 3_000_000);
});

test("le même événement Plex reçu 10 fois ne produit qu'une seule décision logique (idempotence)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 4;
  // Le userId (déjà unique par exécution via freshUserId()) doit faire
  // partie de la clé : l'index unique du ledger est (source,
  // source_event_id) SANS user_id (voir database.ts) — un identifiant
  // littéral fixe collisionnerait avec une exécution précédente du test
  // dans le même fichier SQLite persistant.
  const sourceEventId = `plex:acc:samekey:${userId}`;
  let acceptedCount = 0;
  for (let i = 0; i < 10; i++) {
    const result = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: 1_000_000, source: "plex_history", sourceEventId });
    if (result.accepted) acceptedCount++;
    else assert.equal(result.reason, "duplicate");
  }
  assert.equal(acceptedCount, 1, "une seule des 10 tentatives doit être acceptée comme nouvelle");
});

test("isolation multi-utilisateur : l'état de l'utilisateur A n'a aucun impact sur B", (t) => {
  if (skipIfNoDb(t)) return;
  const userA = freshUserId();
  const userB = freshUserId();
  const tmdbId = 5;
  applyWatchDecision({ userId: userA, tmdbId, mediaType: "movie", state: "watched", occurredAt: 1_000_000, source: "movviz_manual" });
  const stateB = applyWatchDecision({ userId: userB, tmdbId, mediaType: "movie", state: "watched", occurredAt: 500_000, source: "plex_history" });
  // userB n'a aucune décision préalable : la sienne doit partir d'UNKNOWN,
  // pas hériter de l'état déjà décidé pour userA sur le même tmdbId.
  assert.equal(stateB.previousState, "unknown");
  assert.equal(stateB.accepted, true);
});

test("un import externe ancien (T0) perd contre une action manuelle plus récente (T2)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 6;
  const manual = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "unwatched", occurredAt: 2_000_000, source: "movviz_manual" });
  assert.equal(manual.accepted, true);
  const lateImport = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: 1_000_000, source: "external_import" });
  assert.equal(lateImport.accepted, false);
  assert.equal(lateImport.effectiveState, "unwatched");
});

test("égalité stricte de timestamp : la priorité de source départage (manuel > lecteur > Plex > import > migration)", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 7;
  const T = 5_000_000;
  const plex = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: T, source: "plex_history" });
  assert.equal(plex.accepted, true);
  // Même timestamp exact, mais un import externe a une priorité plus basse
  // que Plex -> ne doit PAS gagner à égalité de temps.
  const importAtSameTime = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "unwatched", occurredAt: T, source: "external_import", sourceEventId: `import:${userId}:${tmdbId}:${T}` });
  assert.equal(importAtSameTime.accepted, false);
  assert.equal(importAtSameTime.reason, "tie_break");
  // Un toggle manuel au MÊME timestamp exact a une priorité plus haute que
  // Plex -> doit gagner même sans avantage temporel.
  const manualAtSameTime = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "unwatched", occurredAt: T, source: "movviz_manual", sourceEventId: `manual:${userId}:${tmdbId}:${T}` });
  assert.equal(manualAtSameTime.accepted, true);
  assert.equal(manualAtSameTime.reason, "tie_break");
  assert.equal(manualAtSameTime.effectiveState, "unwatched");
});

test("granularité épisode : deux épisodes distincts de la même série ont un état indépendant", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 8;
  const ep1 = applyWatchDecision({ userId, tmdbId, mediaType: "episode", seasonNumber: 1, episodeNumber: 1, state: "watched", occurredAt: 1_000_000, source: "movviz_manual" });
  const ep2Before = applyWatchDecision({ userId, tmdbId, mediaType: "episode", seasonNumber: 1, episodeNumber: 2, state: "watched", occurredAt: 500_000, source: "plex_history" });
  assert.equal(ep1.accepted, true);
  assert.equal(ep2Before.previousState, "unknown");
  const ep1Unwatch = applyWatchDecision({ userId, tmdbId, mediaType: "episode", seasonNumber: 1, episodeNumber: 1, state: "unwatched", occurredAt: 2_000_000, source: "movviz_manual" });
  assert.equal(ep1Unwatch.accepted, true);
  // S01E02 ne doit subir aucun changement du fait de la décision sur S01E01.
  const ep2Check = applyWatchDecision({ userId, tmdbId, mediaType: "episode", seasonNumber: 1, episodeNumber: 2, state: "watched", occurredAt: 400_000, source: "plex_history", sourceEventId: `check:${userId}:${tmdbId}:2` });
  assert.equal(ep2Check.previousState, "watched", "S01E02 reste vu, non affecté par S01E01");
});
