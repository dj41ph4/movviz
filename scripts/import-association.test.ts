import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImportedSeasonAssociation } from "@/lib/library/importAssociation";
import { parseRelease } from "@/lib/naming/parser";

test("le titre réel de Gangs of London S02 est identifié comme saison 2", () => {
  assert.equal(parseRelease("Gangs.of.London.S02.PROPER.MULTi.1080p.WEB.H264-FW").season, 2);
});

test("un pack S02 associé par erreur à S01 est rattaché à S02", () => {
  assert.equal(resolveImportedSeasonAssociation(1, [2, 2, 2], [0, 1, 2, 3]), 2);
});

test("un pack mixte ou sans saison ne change jamais l'association demandée", () => {
  assert.equal(resolveImportedSeasonAssociation(1, [1, 2], [1, 2]), 1);
  assert.equal(resolveImportedSeasonAssociation(1, [2, null], [1, 2]), 1);
  assert.equal(resolveImportedSeasonAssociation(1, [null, undefined], [1, 2]), 1);
});

test("une saison inconnue ne peut pas être créée ou associée par inférence", () => {
  assert.equal(resolveImportedSeasonAssociation(1, [4, 4], [1, 2, 3]), 1);
});
