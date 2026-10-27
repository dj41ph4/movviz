import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeUnmappedRegistry, type UnmappedRegistry } from "@/lib/plex/unmappedEpisodes";
import type { PlexEpisodeIdentity } from "@/lib/plex/client";

const id = (ratingKey: string, showKey: string, showTitle: string, season: number, episode: number): PlexEpisodeIdentity =>
  ({ ratingKey, title: `Ép ${episode}`, showKey, showTitle, season, episode });
const identities = (...items: PlexEpisodeIdentity[]) => new Map(items.map((i) => [i.ratingKey, i] as const));
/** Épisodes vus sans fiche : clé Plex → comptes qui les ont vus. */
const seen = (...entries: [string, ...string[]][]) => new Map(entries.map(([rk, ...users]) => [rk, new Set(users)] as const));
const none: UnmappedRegistry = { version: 1, shows: {} };

test("les épisodes vus sans fiche sont regroupés par série et triés par saison puis épisode", () => {
  const reg = mergeUnmappedRegistry(
    none,
    seen(["3", "alice"], ["1", "alice"], ["2", "alice"]),
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

test("les comptes qui ont vu les épisodes d'une série sont tous listés, triés et sans doublon", () => {
  const reg = mergeUnmappedRegistry(
    none,
    seen(["1", "dj41ph4"], ["2", "flayz", "dj41ph4"], ["3", "misscassylove"]),
    identities(id("1", "S1", "Série A", 1, 1), id("2", "S1", "Série A", 1, 2), id("3", "S2", "Série B", 1, 1)),
    new Map([["S1", 111], ["S2", 222]]),
    1000,
  );
  assert.deepEqual(reg.shows.S1.watchedBy, ["dj41ph4", "flayz"]);
  assert.deepEqual(reg.shows.S2.watchedBy, ["misscassylove"]);
});

test("une série ignorée le reste, et sa date de première apparition est conservée", () => {
  const first = mergeUnmappedRegistry(none, seen(["1", "a"]), identities(id("1", "S1", "Série A", 1, 1)), new Map([["S1", 111]]), 1000);
  const ignored: UnmappedRegistry = { ...first, shows: { S1: { ...first.shows.S1, dismissed: true } } };
  // Passage suivant : un épisode de plus, sans nouvelle identité pour le premier (déjà connu du registre).
  const next = mergeUnmappedRegistry(ignored, seen(["1", "a"], ["2", "b"]), identities(id("2", "S1", "Série A", 1, 2)), new Map(), 5000);
  assert.equal(next.shows.S1.dismissed, true, "les nouveaux épisodes d'une série ignorée restent ignorés");
  assert.equal(next.shows.S1.firstSeenAt, 1000);
  assert.equal(next.shows.S1.updatedAt, 5000);
  assert.equal(next.shows.S1.episodes.length, 2);
  assert.equal(next.shows.S1.tmdbId, 111, "l'identité TMDb déjà résolue est conservée");
  assert.deepEqual(next.shows.S1.watchedBy, ["a", "b"]);
});

test("une série dont tous les épisodes ont maintenant une fiche quitte le registre", () => {
  const first = mergeUnmappedRegistry(none, seen(["1", "a"]), identities(id("1", "S1", "Série A", 1, 1)), new Map([["S1", 111]]), 1000);
  const next = mergeUnmappedRegistry(first, new Map(), new Map(), new Map(), 2000);
  assert.deepEqual(next.shows, {});
});

test("une clé dont l'identité n'est pas connue est sautée sans casser les autres", () => {
  const reg = mergeUnmappedRegistry(none, seen(["1", "a"], ["inconnue", "a"]), identities(id("1", "S1", "Série A", 1, 1)), new Map(), 1000);
  assert.deepEqual(Object.keys(reg.shows), ["S1"]);
  assert.equal(reg.shows.S1.episodes.length, 1);
  assert.equal(reg.shows.S1.tmdbChecked, false, "série non interrogée : elle sera redemandée");
});
