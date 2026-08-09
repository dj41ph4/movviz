import { test } from "node:test";
import assert from "node:assert/strict";
import { titleSimilarity, releaseTitleMatches } from "@/lib/library/matching";

test("un mot entièrement différent rejette le match même si les caractères sont proches (How I Met Your Father != Mother)", () => {
  // Confirmed live: this exact pair scored ~0.91 (well above the 0.72
  // match threshold) under pure Levenshtein character distance, because
  // "father"/"mother" differ by only 2 of 6 characters relative to the
  // full ~22-character title — causing the auto-grab search for "How I
  // Met Your Mother" to accept releases of the unrelated spin-off show
  // "How I Met Your Father".
  assert.equal(titleSimilarity("How I Met Your Father", "How I Met Your Mother") < 0.72, true);
  assert.equal(releaseTitleMatches("How I Met Your Father", "How I Met Your Mother"), false);
});

test("une variante orthographique/typo d'un mot reste acceptée", () => {
  assert.equal(titleSimilarity("Naruto Shippuden", "Naruto Shippuuden") >= 0.72, true);
  assert.equal(releaseTitleMatches("Naruto Shippuden", "Naruto Shippuuden"), true);
});

test("titre identique après normalisation = 1", () => {
  assert.equal(titleSimilarity("Grey's Anatomy", "Grey's Anatomy"), 1);
});

test("préfixe partagé mais série différente (Dragon Ball Super != Dragon Ball Z)", () => {
  assert.equal(releaseTitleMatches("Dragon Ball Super", "Dragon Ball Z"), false);
});

test("titre avec + ne matche pas une série différente commençant par le même mot (Blood+ != Blood of Zeus)", () => {
  // "Blood+" normalisé en "blood" (le + était supprimé) → "blood" est contenu
  // dans "blood of zeus" → score 0.85, au-dessus du seuil. Le + doit devenir
  // "plus" pour que les deux titres soient distincts.
  assert.equal(releaseTitleMatches("Blood of Zeus S01E01", "Blood+"), false);
  assert.equal(releaseTitleMatches("Blood.of.Zeus.S01E01.1080p", "Blood+"), false);
});

test("release Blood Plus matche bien la cible Blood+", () => {
  assert.equal(releaseTitleMatches("Blood Plus S01E01", "Blood+"), true);
  assert.equal(releaseTitleMatches("Blood+ S01E01", "Blood+"), true);
});
