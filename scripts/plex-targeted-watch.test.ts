import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "@/lib/plex/plexReconciler";

const userId = "targeted-watch-test";
const machineIdentifier = "plex-test-machine";
const ratingKey = "4242";

test("la vérification ciblée applique un vu Plex sans attendre un snapshot global", () => {
  const result = reconcile({
    userId,
    canonicalIdentity: { type: "movie", tmdbId: 1145899 },
    ratingKey,
    machineIdentifier,
    currentCanonicalState: "unwatched",
    currentCanonicalAt: 1_000,
    previousPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "UNWATCHED",
      observedAt: 1_000,
    },
    currentPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "WATCHED",
      viewCount: 1,
      lastViewedAt: 2_000,
      observedAt: 2_100,
    },
  });

  assert.equal(result.decision, "REMOTE_WATCHED");
  assert.equal(result.shouldApply, true);
  assert.equal(result.newCanonicalState, "watched");
});

test("une observation Plex stable répare une fiche Movviz restée désynchronisée", () => {
  const result = reconcile({
    userId,
    canonicalIdentity: { type: "movie", tmdbId: 1145899 },
    ratingKey,
    machineIdentifier,
    currentCanonicalState: "unwatched",
    currentCanonicalAt: 1_000,
    previousPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "WATCHED",
      viewCount: 1,
      lastViewedAt: 2_000,
      observedAt: 2_010,
    },
    currentPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "WATCHED",
      viewCount: 1,
      lastViewedAt: 2_000,
      observedAt: 2_100,
    },
  });

  assert.equal(result.decision, "REMOTE_WATCHED");
  assert.equal(result.shouldApply, true);
  assert.equal(result.newCanonicalState, "watched");
  assert.equal(result.reason, "state_repair_observed_watched");
});

test("la vérification ciblée ne remplace pas un non-vu local plus récent", () => {
  const result = reconcile({
    userId,
    canonicalIdentity: { type: "movie", tmdbId: 1145899 },
    ratingKey,
    machineIdentifier,
    currentCanonicalState: "unwatched",
    currentCanonicalAt: 3_000,
    previousPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "UNWATCHED",
      observedAt: 1_000,
    },
    currentPlexObserved: {
      userId,
      machineIdentifier,
      ratingKey,
      state: "WATCHED",
      viewCount: 1,
      lastViewedAt: 2_000,
      observedAt: 2_100,
    },
  });

  assert.equal(result.decision, "STALE_OBSERVATION");
  assert.equal(result.shouldApply, false);
});
