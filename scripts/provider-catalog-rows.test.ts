import { test } from "node:test";
import assert from "node:assert/strict";
import { providerRowsFor, providerRowDef } from "@/lib/metadata/providerCatalog";

const NETFLIX = 8;
const DISNEY_PLUS = 337;
const PRIME = 119;

test("Netflix a autant de rangées que Disney+ (qui avait déjà ses propres rangées)", () => {
  assert.equal(providerRowsFor(NETFLIX).length, providerRowsFor(DISNEY_PLUS).length);
});

test("les rangées propres à Netflix n'apparaissent que sur Netflix, celles de Disney+ restent sur Disney+", () => {
  const keys = (id: number) => providerRowsFor(id).map((r) => r.key);
  for (const key of ["netflixoriginals", "ghibli", "spanish", "british", "german"]) {
    assert.ok(keys(NETFLIX).includes(key), `${key} absente de Netflix`);
    assert.ok(!keys(PRIME).includes(key), `${key} ne doit pas apparaître chez Prime`);
    assert.ok(!keys(DISNEY_PLUS).includes(key), `${key} ne doit pas apparaître chez Disney+`);
  }
  assert.ok(keys(DISNEY_PLUS).includes("marvel"));
  assert.ok(!keys(NETFLIX).includes("marvel"));
});

test("les autres plateformes gardent exactement leurs rangées d'avant", () => {
  assert.equal(providerRowsFor(PRIME).length, 28);
  assert.equal(providerRowsFor(null).length, 28);
});

test("chaque rangée a une clé unique et une définition", () => {
  const rows = providerRowsFor(NETFLIX);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  for (const row of rows) assert.ok(providerRowDef(row.key), row.key);
});
