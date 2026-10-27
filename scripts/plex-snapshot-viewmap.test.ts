import { test } from "node:test";
import assert from "node:assert/strict";
import { rawToViewState, viewMapFromListings, numberedEpisodes, episodesListingConsistent } from "@/lib/plex/plexSnapshotViewMap";
import type { RawLibraryItem } from "@/lib/plex/client";

const item = (extra: Partial<RawLibraryItem> & { ratingKey: string; parentIndex?: number; index?: number }): RawLibraryItem =>
  ({ title: "t", ...extra }) as RawLibraryItem;

test("un média jamais vu : viewCount 0, comme le faisait la lecture par paquets", () => {
  const state = rawToViewState(item({ ratingKey: "1" }));
  assert.equal(state.viewCount, 0);
  assert.equal(state.lastViewedAt, undefined);
  assert.equal(state.viewOffset, undefined);
});

test("lastViewedAt en secondes est converti en millisecondes, celui déjà en ms est conservé", () => {
  assert.equal(rawToViewState(item({ ratingKey: "1", viewCount: 1, lastViewedAt: 1_700_000_000 })).lastViewedAt, 1_700_000_000_000);
  assert.equal(rawToViewState(item({ ratingKey: "1", viewCount: 1, lastViewedAt: 1_700_000_000_000 })).lastViewedAt, 1_700_000_000_000);
});

test("viewOffset, durée et type d'un média en cours sont repris", () => {
  const state = rawToViewState(item({ ratingKey: "2", viewOffset: 1234, duration: 5000, type: "episode" }));
  assert.deepEqual([state.viewOffset, state.duration, state.type, state.viewCount], [1234, 5000, "episode", 0]);
});

test("les films et les épisodes sont fusionnés par clé", () => {
  const map = viewMapFromListings(
    [item({ ratingKey: "10", viewCount: 2 })],
    [item({ ratingKey: "20", viewCount: 1 }), item({ ratingKey: "21" })],
  );
  assert.deepEqual([...map.keys()].sort(), ["10", "20", "21"]);
  assert.equal(map.get("10")?.viewCount, 2);
  assert.equal(map.get("21")?.viewCount, 0);
});

test("un épisode sans numéro de saison ou d'épisode est écarté, comme avec allLeaves", () => {
  const kept = numberedEpisodes([
    item({ ratingKey: "a", parentIndex: 1, index: 1 }),
    item({ ratingKey: "b", parentIndex: 0, index: 3 }),
    item({ ratingKey: "c", parentIndex: 1 }),
    item({ ratingKey: "d" }),
  ]);
  assert.deepEqual(kept.map((e) => e.ratingKey), ["a", "b"]);
});

test("le garde-fou refuse un listing tronqué ou invérifiable", () => {
  assert.equal(episodesListingConsistent(35471, 35471), true);
  assert.equal(episodesListingConsistent(34800, 35471), true); // ≥ 98 %
  assert.equal(episodesListingConsistent(30000, 35471), false); // listing tronqué
  assert.equal(episodesListingConsistent(100, 0), false); // total annoncé absent
  assert.equal(episodesListingConsistent(0, 0), false);
});
