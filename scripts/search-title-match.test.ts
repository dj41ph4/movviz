import { test } from "node:test";
import assert from "node:assert/strict";
import { titleMatchesQuery } from "@/lib/metadata/searchTitleMatch";

test("le titre tapé garde un film sans votes (Un bon avocat)", () => {
  assert.equal(titleMatchesQuery(["Un bon avocat", undefined], "un bon avocat"), true);
  assert.equal(titleMatchesQuery(["Un Bon Avocat"], "  UN BON  avocat "), true);
  assert.equal(titleMatchesQuery(["Élève"], "eleve"), true);
  assert.equal(titleMatchesQuery([null, "A Good Lawyer"], "good lawyer"), true);
});

test("un titre sans rapport avec la recherche reste filtré", () => {
  assert.equal(titleMatchesQuery(["Un avocat du diable"], "un bon avocat"), false);
  assert.equal(titleMatchesQuery(["Ok"], "ok computer"), false);
  assert.equal(titleMatchesQuery(["Un bon avocat"], ""), false);
});
