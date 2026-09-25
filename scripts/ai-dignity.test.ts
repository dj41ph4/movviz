import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDialogueTurn } from "../src/lib/ai/dialogueDirector.ts";
import { extractSelfIntroName, extractNameFromDirectAnswer } from "../src/lib/ai/intentParser.ts";
import { isTitleNameFact, reframeTitleNameFact } from "../src/lib/ai/addressTitles.ts";
import { historyForModel } from "../src/lib/ai/chatAssist.ts";

test("« appelle-moi maître » n'est jamais un prénom", () => {
  assert.equal(extractSelfIntroName("appelle moi maître"), null);
  assert.equal(extractSelfIntroName("Appelle-moi Seigneur"), null);
  assert.equal(extractNameFromDirectAnswer("Comment tu t'appelles ?", "Majesté"), null);
  assert.equal(extractSelfIntroName("appelle-moi Théo"), "Prénom : Théo");
});

test("un ancien fait « Prénom : Maître » redevient une exigence de titre", () => {
  assert.equal(isTitleNameFact("Prénom : Maître"), true);
  assert.equal(isTitleNameFact("Prénom : Alex"), false);
  const reframed = reframeTitleNameFact("Prénom : Maître");
  assert.match(reframed, /Maître/);
  assert.doesNotMatch(reframed, /pr[ée]nom/i);
  assert.equal(reframeTitleNameFact("Prénom : Alex"), "Prénom : Alex");
});

test("une demande de soumission a sa propre consigne, sans phrase imposée", () => {
  for (const msg of ["appelle moi maître", "je suis ton seigneur", "obéis !", "tu es mon esclave", "appelez-moi votre majesté"]) {
    assert.equal(analyzeDialogueTurn(msg, [], undefined).intent, "submission", msg);
  }
  for (const msg of ["appelle-moi Théo", "dis-moi le film", "le film Soumission est bien ?"]) {
    assert.notEqual(analyzeDialogueTurn(msg, [], undefined).intent, "submission", msg);
  }
});

test("le modèle voit les titres qu'il a proposés dans l'historique", () => {
  const history = historyForModel([
    { role: "user", content: "un film d'horreur" },
    { role: "assistant", content: "Tiens :", recommendations: [
      { title: "Get Out", year: 2017, type: "movie", tmdbId: 1 },
      { title: "Dark", year: 2017, type: "series", tmdbId: 2 },
    ] } as never,
    { role: "user", content: "pourquoi le deuxième ?" },
  ]);
  assert.match(history[1].content, /1\. Get Out \(2017\), film\n2\. Dark \(2017\), série/);
  assert.equal(history[0].content, "un film d'horreur");
});
