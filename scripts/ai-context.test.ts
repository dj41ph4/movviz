import { test } from "node:test";
import assert from "node:assert/strict";
import { saveContextInsights, getContextProfile, recordCorrection, getCorrections, buildCorrectionEscalationContext, setRating, getRating, getAllRatings, buildRatingsContext, recordFeedback, getFeedback, removeFeedback, getLastProactiveRatingAskAt, markProactiveRatingAsked } from "@/lib/ai/tasteProfile";
import type { AiContextInsight } from "@/lib/ai/types";

/**
 * "Créer le contexte" (profil utilisateur) — the merge logic in
 * saveContextInsights is the part that keeps the consolidated context from
 * silently duplicating itself every incremental pass: an insight whose text
 * matches an existing one (normalized) should UPDATE it in place, a
 * genuinely new one should be appended. Uses a fresh userId per test so
 * this never touches another test's/real data in the shared JSON store.
 */
function insight(text: string, confidence = 0.7, trend: AiContextInsight["trend"] = "stable"): AiContextInsight {
  return { text, confidence, evidenceCount: 3, trend, at: Date.now(), source: "bootstrap" };
}

// Bug fix: the correction tests below use recordCorrection(), which APPENDS
// to the on-disk store rather than replacing it (unlike saveContextInsights
// with merge=false, which wipes first and is naturally idempotent across
// repeated `npm test` runs). A fixed userId here would silently accumulate
// corrections across every prior run in this dev session, eventually
// pushing "below threshold" tests past the threshold for reasons that have
// nothing to do with the code under test. Suffixed so every run starts clean.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("saveContextInsights: bootstrap (merge=false) remplace tout contexte précédent", () => {
  const userId = "test-user-context-bootstrap";
  saveContextInsights(userId, [insight("A")], false);
  saveContextInsights(userId, [insight("B")], false);
  const context = getContextProfile(userId)!;
  assert.deepEqual(context.insights.map((i) => i.text), ["B"]);
});

test("saveContextInsights: incrémental (merge=true) met à jour un insight existant au lieu de le dupliquer", () => {
  const userId = "test-user-context-incremental-update";
  saveContextInsights(userId, [insight("Aime la parodie absurde", 0.5)], false);
  saveContextInsights(userId, [insight("aime la parodie absurde", 0.9, "stable")], true); // même texte, casse différente
  const context = getContextProfile(userId)!;
  assert.equal(context.insights.length, 1, "pas de doublon — texte normalisé identique");
  assert.equal(context.insights[0].confidence, 0.9, "la confiance la plus récente remplace l'ancienne");
});

test("saveContextInsights: incrémental (merge=true) ajoute un insight vraiment nouveau sans toucher les autres", () => {
  const userId = "test-user-context-incremental-append";
  saveContextInsights(userId, [insight("Suit ses franchises jusqu'au bout")], false);
  saveContextInsights(userId, [insight("Préfère les séries courtes")], true);
  const context = getContextProfile(userId)!;
  assert.deepEqual(
    context.insights.map((i) => i.text).sort(),
    ["Préfère les séries courtes", "Suit ses franchises jusqu'au bout"]
  );
});

/**
 * Round-trip proof for `corrections` (write → read survives) — same class
 * of bug a previous session found for `context` (silently dropped by
 * profileForUser because it wasn't copied through). Writing a correction
 * then reading it back through a SEPARATE call must return it unchanged,
 * or this exact bug has recurred.
 */
test("recordCorrection/getCorrections: une correction survit à un aller-retour écriture/lecture", () => {
  const userId = `test-user-corrections-roundtrip-${runId}`;
  recordCorrection(userId, { category: "library_false_negative", note: "ben si, j'ai les duo impossible" });
  const corrections = getCorrections(userId);
  assert.equal(corrections.length, 1);
  assert.equal(corrections[0].category, "library_false_negative");
  assert.equal(corrections[0].note, "ben si, j'ai les duo impossible");
  assert.ok(typeof corrections[0].at === "number" && corrections[0].at > 0);
});

test("recordCorrection: n'écrase pas les faits/feedback/context déjà présents pour cet utilisateur (garde-fou anti-régression du bug 'context perdu')", () => {
  const userId = `test-user-corrections-preserves-siblings-${runId}`;
  saveContextInsights(userId, [{ text: "Suit ses franchises", confidence: 0.7, evidenceCount: 3, trend: "stable", at: Date.now(), source: "bootstrap" }], false);
  recordCorrection(userId, { category: "library_false_negative", note: "c'est faux" });
  const context = getContextProfile(userId);
  assert.ok(context && context.insights.length === 1, "le context posé avant doit survivre à l'écriture d'une correction");
});

test("buildCorrectionEscalationContext: vide sous le seuil (1-2 corrections)", () => {
  const userId = `test-user-corrections-below-threshold-${runId}`;
  recordCorrection(userId, { category: "library_false_negative", note: "a" });
  recordCorrection(userId, { category: "library_false_negative", note: "b" });
  assert.equal(buildCorrectionEscalationContext(userId), "");
});

test("buildCorrectionEscalationContext: non vide dès le seuil atteint (3 corrections), cite le compte", () => {
  const userId = `test-user-corrections-at-threshold-${runId}`;
  recordCorrection(userId, { category: "library_false_negative", note: "a" });
  recordCorrection(userId, { category: "library_false_negative", note: "b" });
  recordCorrection(userId, { category: "library_false_negative", note: "c" });
  const escalation = buildCorrectionEscalationContext(userId);
  assert.ok(escalation.length > 0);
  assert.ok(escalation.includes("3"));
});

test("buildCorrectionEscalationContext: une correction de catégorie 'other' ne compte pas vers le seuil library_false_negative", () => {
  const userId = `test-user-corrections-other-category-excluded-${runId}`;
  recordCorrection(userId, { category: "other", note: "a" });
  recordCorrection(userId, { category: "other", note: "b" });
  recordCorrection(userId, { category: "other", note: "c" });
  assert.equal(buildCorrectionEscalationContext(userId), "");
});

test("setRating/getRating: une note explicite survit à un aller-retour écriture/lecture", () => {
  const userId = `test-user-rating-roundtrip-${runId}`;
  setRating(userId, { tmdbId: 438631, type: "movie", title: "Dune", rating: 5, source: "explicit", confidence: 1 });
  const rating = getRating(userId, 438631, "movie");
  assert.ok(rating);
  assert.equal(rating!.rating, 5);
  assert.equal(rating!.source, "explicit");
  assert.equal(rating!.history.length, 1);
});

test("setRating: une note explicite écrase une note explicite précédente et journalise l'historique", () => {
  const userId = `test-user-rating-explicit-overwrite-${runId}`;
  setRating(userId, { tmdbId: 1, type: "movie", title: "X", rating: 3, source: "explicit", confidence: 1 });
  setRating(userId, { tmdbId: 1, type: "movie", title: "X", rating: 5, source: "explicit", confidence: 1 });
  const rating = getRating(userId, 1, "movie")!;
  assert.equal(rating.rating, 5);
  assert.equal(rating.history.length, 2);
});

test("setRating: une note déduite ne peut jamais écraser une note explicite existante, mais reste journalisée", () => {
  const userId = `test-user-rating-inferred-never-overrides-explicit-${runId}`;
  setRating(userId, { tmdbId: 2, type: "movie", title: "Y", rating: 5, source: "explicit", confidence: 1 });
  setRating(userId, { tmdbId: 2, type: "movie", title: "Y", rating: 1, source: "inferred", confidence: 0.6, opinion: "quelle merde" });
  const rating = getRating(userId, 2, "movie")!;
  assert.equal(rating.rating, 5, "la note affichée reste la note explicite");
  assert.equal(rating.source, "explicit");
  assert.equal(rating.history.length, 2, "la tentative déduite est quand même journalisée");
  assert.equal(rating.history[1].rating, 1);
});

test("setRating: une note déduite s'applique normalement en l'absence de note explicite précédente", () => {
  const userId = `test-user-rating-inferred-applies-${runId}`;
  setRating(userId, { tmdbId: 3, type: "series", title: "Z", rating: 4, source: "inferred", confidence: 0.6 });
  const rating = getRating(userId, 3, "series")!;
  assert.equal(rating.rating, 4);
  assert.equal(rating.source, "inferred");
});

test("setRating: la note est bornée à 1-5 et arrondie", () => {
  const userId = `test-user-rating-clamped-${runId}`;
  setRating(userId, { tmdbId: 4, type: "movie", title: "W", rating: 8, source: "explicit", confidence: 1 });
  assert.equal(getRating(userId, 4, "movie")!.rating, 5);
});

test("getAllRatings: retourne toutes les notes d'un utilisateur, aucune autre", () => {
  const userId = `test-user-rating-getall-${runId}`;
  setRating(userId, { tmdbId: 10, type: "movie", title: "A", rating: 5, source: "explicit", confidence: 1 });
  setRating(userId, { tmdbId: 11, type: "series", title: "B", rating: 2, source: "explicit", confidence: 1 });
  const ratings = getAllRatings(userId);
  assert.equal(ratings.length, 2);
});

test("buildRatingsContext: vide sans notes, non vide dès qu'une note existe et cite le titre", () => {
  const emptyUserId = `test-user-rating-context-empty-${runId}`;
  assert.equal(buildRatingsContext(emptyUserId), "");

  const userId = `test-user-rating-context-nonempty-${runId}`;
  setRating(userId, { tmdbId: 20, type: "movie", title: "Interstellar", rating: 5, source: "explicit", confidence: 1 });
  const context = buildRatingsContext(userId);
  assert.ok(context.includes("Interstellar"));
});

test("removeFeedback: retire un retour existant, silencieux si déjà absent", () => {
  const userId = `test-user-remove-feedback-${runId}`;
  recordFeedback(userId, { tmdbId: 50, type: "movie", title: "Hot Fuzz", liked: false, at: Date.now() });
  assert.equal(getFeedback(userId).length, 1);
  removeFeedback(userId, 50, "movie");
  assert.equal(getFeedback(userId).length, 0);
  removeFeedback(userId, 50, "movie"); // idempotent, ne doit pas jeter
  assert.equal(getFeedback(userId).length, 0);
});

test("removeFeedback: ne retire que l'entrée ciblée, jamais les autres", () => {
  const userId = `test-user-remove-feedback-selective-${runId}`;
  recordFeedback(userId, { tmdbId: 51, type: "movie", title: "A", liked: true, at: Date.now() });
  recordFeedback(userId, { tmdbId: 52, type: "movie", title: "B", liked: false, at: Date.now() });
  removeFeedback(userId, 51, "movie");
  const remaining = getFeedback(userId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].tmdbId, 52);
});

test("getLastProactiveRatingAskAt/markProactiveRatingAsked : 0 par défaut, met bien à jour un timestamp récent", () => {
  const userId = `test-user-proactive-rating-cooldown-${runId}`;
  assert.equal(getLastProactiveRatingAskAt(userId), 0);
  const before = Date.now();
  markProactiveRatingAsked(userId);
  const after = getLastProactiveRatingAskAt(userId);
  assert.ok(after >= before);
});
