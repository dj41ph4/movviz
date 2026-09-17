import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { applyWatchDecision } from "@/lib/userContext/watchBridge";
import { setWatchedMovies, mergePlexWatchedState, getWatchStatus } from "@/lib/plex/watchStore";

function freshUserId(): string {
  return `test-plexmerge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * mergePlexWatchedState() ne doit JAMAIS faire confiance aveuglément à son
 * appelant : même appelée directement (sans passer par le filtrage de
 * watchSync.ts), elle doit revérifier l'état canonique et refuser de
 * ressusciter un titre marqué non vu plus récemment. C'est le scénario
 * exact du plan de centralisation watched (§1, §71) — la régression que ce
 * garde-fou corrige a été trouvée en testant l'intégration réelle, pas
 * seulement le resolver bas niveau.
 */
test("mergePlexWatchedState() reste sûre même appelée directement, sans filtrage préalable par applyWatchDecision", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const userId = freshUserId();
  const tmdbId = 100_000_001;
  const T1 = 1_000_000;
  const T2 = 2_000_000;

  setWatchedMovies(userId, [tmdbId], true, "Film Test", T1, "plex_history");
  assert.deepEqual(getWatchStatus(userId)?.movies, [tmdbId]);

  setWatchedMovies(userId, [tmdbId], false, "Film Test", T2, "movviz_manual");
  assert.deepEqual(getWatchStatus(userId)?.movies, []);

  // Appel direct, sans passer par applyWatchDecision au préalable — simule
  // un futur appelant qui oublierait le filtrage, ou un bug de régression.
  mergePlexWatchedState(userId, [{ tmdbId, title: "Film Test", watchedAt: T1 }], []);
  assert.deepEqual(getWatchStatus(userId)?.movies, [], "un appel direct ne doit pas ressusciter le film");
});

test("mergePlexWatchedState() reflète bien un titre correctement décidé WATCHED au préalable", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const userId = freshUserId();
  const tmdbId = 100_000_002;
  const T1 = 1_000_000;

  const result = applyWatchDecision({ userId, tmdbId, mediaType: "movie", title: "Film Test 2", state: "watched", occurredAt: T1, source: "plex_history" });
  assert.equal(result.accepted, true);
  mergePlexWatchedState(userId, [{ tmdbId, title: "Film Test 2", watchedAt: T1 }], []);
  assert.deepEqual(getWatchStatus(userId)?.movies, [tmdbId]);
});

test("mergePlexWatchedState() sur un épisode non-décidé (UNKNOWN) est acceptée — seul un UNWATCHED explicite bloque", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const userId = freshUserId();
  const tmdbId = 100_000_003;
  mergePlexWatchedState(userId, [], [{ tmdbId, season: 1, episode: 1, title: "Série Test", watchedAt: 1_000_000 }]);
  const status = getWatchStatus(userId);
  assert.ok(status?.episodes.some((e) => e.tmdbId === tmdbId && e.season === 1 && e.episode === 1));
});
