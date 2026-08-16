import { test } from "node:test";
import assert from "node:assert/strict";
import { averageProfiles } from "@/lib/ai/contrastiveProfile";

test("averageProfiles: moyenne un seul profil = lui-même", () => {
  const p = { humour: { absurde: 0.9, parodie: 0.8 } };
  assert.deepEqual(averageProfiles([p]), p);
});

test("averageProfiles: moyenne correcte trait par trait sur plusieurs profils", () => {
  const a = { humour: { absurde: 1.0 }, energie: { rapide: 0.6 } };
  const b = { humour: { absurde: 0.5 } };
  const got = averageProfiles([a, b]);
  assert.equal(got.humour.absurde, 0.75); // (1.0 + 0.5) / 2
  assert.equal(got.energie.rapide, 0.6); // seul un profil a ce trait — moyenne = lui-même
});

test("averageProfiles: liste vide => profil vide", () => {
  assert.deepEqual(averageProfiles([]), {});
});
