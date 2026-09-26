import test from "node:test";
import assert from "node:assert/strict";
import { asksForSimilar, saysMisunderstood } from "../src/lib/ai/chatAssist";

test("seule une vraie demande de similaire prend le sujet de la conversation pour modèle", () => {
  for (const m of ["fais comme tu veux", "conseille-moi un film", "rien d'autre", "surprends-moi"]) assert.equal(asksForSimilar(m), false, m);
  for (const m of ["un autre dans le même genre", "dans la lignée", "des films comme celui-là", "quelque chose de similaire", "un truc comme ça", "d'autres comme lui"]) assert.equal(asksForSimilar(m), true, m);
});

test("une correction de l'utilisateur fait oublier le titre mal compris", () => {
  assert.equal(saysMisunderstood("je t'ai demandé s'il y avait rien d'autre à me donner comme film est-ce qu'ils ont handicapé"), true);
  for (const m of ["c'est pas ça", "t'as mal compris", "je parlais pas de ce film", "mais non"]) assert.equal(saysMisunderstood(m), true, m);
  for (const m of ["fais comme tu veux", "j'adore ce film", "conseille-moi un thriller"]) assert.equal(saysMisunderstood(m), false, m);
});
