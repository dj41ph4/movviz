import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeUnmappedRegistry, type UnmappedRegistry } from "@/lib/plex/unmappedEpisodes";
import type { PlexEpisodeIdentity } from "@/lib/plex/client";

const id = (ratingKey: string, showKey: string, showTitle: string, season: number, episode: number): PlexEpisodeIdentity =>
  ({ ratingKey, title: `Ép ${episode}`, showKey, showTitle, season, episode });
const identities = (...items: PlexEpisodeIdentity[]) => new Map(items.map((i) => [i.ratingKey, i] as const));
const none: UnmappedRegistry = { version: 1, shows: {} };

test("les épisodes vus sans fiche sont regroupés par série et triés par saison puis épisode", () => {
  const reg = mergeUnmappedRegistry(
    none,
    ["3", "1", "2"],
    identities(id("1", "S1", "Série A", 2, 5), id("2", "S1", "Série A", 1, 9), id("3", "S2", "Série B", 1, 1)),
    new Map([["S1", 111], ["S2", null]]),
    1000,
  );
  assert.deepEqual(Object.keys(reg.shows).sort(), ["S1", "S2"]);
  assert.deepEqual(reg.shows.S1.episodes.map((e) => `${e.season}x${e.episode}`), ["1x9", "2x5"]);
  assert.equal(reg.shows.S1.tmdbId, 111);
  assert.equal(reg.shows.S2.tmdbId, null);
  assert.equal(reg.shows.S2.tmdbChecked, true);
  assert.equal(reg.shows.S1.firstSeenAt, 1000);
});

test("une série ignorée le reste, et sa date de première apparition est conservée", () => {
  const first = mergeUnmappedRegistry(none, ["1"], identities(id("1", "S1", "Série A", 1, 1)), new Map([["S1", 111]]), 1000);
  const ignored: UnmappedRegistry = { ...first, shows: { S1: { ...first.shows.S1, dismissed: true } } };
  // Passage suivant : un épisode de plus, sans nouvelle identité pour le premier (déjà connu du registre).
  const next = mergeUnmappedRegistry(ignored, ["1", "2"], identities(id("2", "S1", "Série A", 1, 2)), new Map(), 5000);
  assert.equal(next.shows.S1.dismissed, true);
  assert.equal(next.shows.S1.firstSeenAt, 1000);
  assert.equal(next.shows.S1.updatedAt, 5000);
  assert.equal(next.shows.S1.episodes.length, 2);
  assert.equal(next.shows.S1.tmdbId, 111, "l'identité TMDb déjà résolue est conservée");
});

test("une série dont tous les épisodes ont maintenant une fiche quitte le registre", () => {
  const first = mergeUnmappedRegistry(none, ["1"], identities(id("1", "S1", "Série A", 1, 1)), new Map([["S1", 111]]), 1000);
  const next = mergeUnmappedRegistry(first, [], new Map(), new Map(), 2000);
  assert.deepEqual(next.shows, {});
});

test("une clé dont l'identité n'est pas connue est sautée sans casser les autres", () => {
  const reg = mergeUnmappedRegistry(none, ["1", "inconnue"], identities(id("1", "S1", "Série A", 1, 1)), new Map(), 1000);
  assert.deepEqual(Object.keys(reg.shows), ["S1"]);
  assert.equal(reg.shows.S1.episodes.length, 1);
  assert.equal(reg.shows.S1.tmdbChecked, false, "série non interrogée : elle sera redemandée");
});
