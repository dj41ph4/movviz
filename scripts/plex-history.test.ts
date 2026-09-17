import { test } from "node:test";
import assert from "node:assert/strict";
import { ratingKeyFromPath } from "@/lib/plex/client";

/**
 * Bug réel confirmé en direct (2026-09, tous comptes synchronisés,
 * 100% des épisodes rejetés "malformés") : `/status/sessions/history/all`
 * ne renvoie pas `grandparentRatingKey` sur ce serveur — seulement
 * `grandparentKey`, un chemin complet ("/library/metadata/531052"). Sans
 * repli sur ce champ, chaque épisode était rejeté même avec une entrée par
 * ailleurs complète.
 */
test("ratingKeyFromPath extrait le dernier segment d'un chemin Plex", () => {
  assert.equal(ratingKeyFromPath("/library/metadata/531052"), "531052");
  assert.equal(ratingKeyFromPath("/library/metadata/986222"), "986222");
});

test("ratingKeyFromPath : entrée vide ou absente -> undefined, jamais une chaîne vide", () => {
  assert.equal(ratingKeyFromPath(undefined), undefined);
  assert.equal(ratingKeyFromPath(""), undefined);
  assert.equal(ratingKeyFromPath("/"), undefined);
});

test("ratingKeyFromPath : une valeur déjà bare (sans slash) est retournée telle quelle", () => {
  assert.equal(ratingKeyFromPath("531052"), "531052");
});
