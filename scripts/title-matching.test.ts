import { test } from "node:test";
import assert from "node:assert/strict";
import { titleSimilarity, releaseTitleMatches, pickSearchTitle } from "@/lib/library/matching";
import { sanitizeQuery } from "@/lib/indexers/torznab";

test("pickSearchTitle : un titre original en script non-latin est inexploitable, retombe sur le titre localisé (cas réel : BAKI-DOU, titre original 刃牙道, 0 résultat sur 75 releases indexées)", () => {
  assert.equal(pickSearchTitle("BAKI-DOU : Le samouraï invincible", "刃牙道"), "BAKI-DOU : Le samouraï invincible");
});

test("pickSearchTitle : préfère le titre original en script latin (les releases scene sont nommées d'après lui)", () => {
  assert.equal(pickSearchTitle("Un homme de Toronto", "The Man from Toronto"), "The Man from Toronto");
});

test("pickSearchTitle : pas de titre original distinct => garde le titre tel quel", () => {
  assert.equal(pickSearchTitle("Inception", null), "Inception");
  assert.equal(pickSearchTitle("Inception", "Inception"), "Inception");
});

test("pickSearchTitle : rejette aussi le cyrillique, l'arabe, le coréen et le thaï, pas seulement le CJK", () => {
  assert.equal(pickSearchTitle("Le titre localisé", "Оригинал"), "Le titre localisé");
  assert.equal(pickSearchTitle("Le titre localisé", "العنوان الأصلي"), "Le titre localisé");
  assert.equal(pickSearchTitle("Le titre localisé", "오리지널 제목"), "Le titre localisé");
  assert.equal(pickSearchTitle("Le titre localisé", "ชื่อเรื่องต้นฉบับ"), "Le titre localisé");
});

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

test("faux ami inter-langue rejeté même en similarité de mots (confirmé en direct : demander 'un homme un vrai' à l'assistant IA résolvait vers le film espagnol non lié 'Todo un hombre')", () => {
  // Movviz's AI add_media resolver (resolveAiItem, actions.ts) requires >=
  // 0.45 to accept a TMDb search hit — well under the stricter 0.72 release
  // threshold (AI-provided titles are looser/translated), but this pair
  // must still fail it: "homme" and "hombre" are different words, not a
  // spelling variant of each other.
  assert.equal(titleSimilarity("un homme un vrai", "todo un hombre") < 0.45, true);
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

test("sanitizeQuery préserve le + comme mot (recherche manuelle) — confirmé en direct : « Blood+ » devenait « Blood » avant même d'atteindre normalizeTitle", () => {
  // La correction du + dans normalizeTitle (matching.ts) était sans effet
  // tant que sanitizeQuery — utilisée pour construire matchQuery dans
  // /api/indexers/search AVANT tout appel à titleSimilarity — supprimait le +
  // en amont. Confirmé en direct : recherche manuelle pour "Blood+" affichait
  // "Blood Of Zeus", "Dexter New Blood", "Blood-C"... comme candidats
  // valides, tous scorés "Titre correspondant" via le mot générique "blood".
  assert.equal(sanitizeQuery("Blood+"), "Blood.plus");
  assert.equal(sanitizeQuery("Fear & Loathing"), "Fear.and.Loathing");
});
