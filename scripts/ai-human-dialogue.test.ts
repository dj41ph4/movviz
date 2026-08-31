import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDialogueTurn, selectDialogueCandidate } from "@/lib/ai/dialogueDirector";
import { parseExplicitTitlePreferenceStatement } from "@/lib/ai/factExtractor";

test("taste correction is classified as correction, not banter", () => {
  const plan = analyzeDialogueTurn(
    "ben non tu te trompe, j'adore Watchmen",
    [{ role: "assistant", content: "ancienne affirmation fausse" }, { role: "user", content: "ben non tu te trompe, j'adore Watchmen" }],
    { tension: 3, scene: "none", lastIntent: "playful_provocation", updatedAt: Date.now() },
  );
  assert.equal(plan.intent, "correction");
  assert.equal(plan.tension, 0);
  assert.match(plan.directive, /prime|INTÈGRE/i);
});

test("explicit title preference parser captures Watchmen correction", () => {
  assert.deepEqual(parseExplicitTitlePreferenceStatement("ben non tu te trompe, j'adore Watchmen"), {
    subject: "Watchmen",
    positive: true,
    correction: true,
  });
});

test("neutral/question turns naturally cool prior banter tension", () => {
  const previous = { tension: 2, scene: "none" as const, lastIntent: "playful_provocation", updatedAt: Date.now() };
  const plan = analyzeDialogueTurn("tu sais quoi de moi ?", [{ role: "user", content: "tu sais quoi de moi ?" }], previous);
  assert.equal(plan.intent, "question");
  assert.equal(plan.tension, 1);
});

test("candidate selector rejects canned challenge opener", () => {
  const plan = analyzeDialogueTurn("t'es nul", [{ role: "user", content: "t'es nul" }, { role: "assistant", content: "x" }]);
  const picked = selectDialogueCandidate([
    "Ah, tu veux vraiment jouer à ça ? Très bien, champion, mais sache une chose : je réponds.",
    "Tu m'offres trois lettres et tu veux un feu d'artifice ? Fais un effort 😏",
  ], plan, [], "t'es nul");
  assert.match(picked, /trois lettres/);
});
