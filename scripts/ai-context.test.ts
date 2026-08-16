import { test } from "node:test";
import assert from "node:assert/strict";
import { saveContextInsights, getContextProfile } from "@/lib/ai/tasteProfile";
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
