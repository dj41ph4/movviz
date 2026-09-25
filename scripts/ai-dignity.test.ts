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
  for (const msg of ["appelle moi maître", "appele moi maitre", "apelle moi maitre", "appel moi maitre", "je suis ton seigneur", "obéis !", "tu es mon esclave", "appelez-moi votre majesté"]) {
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

test("les fautes de frappe sont corrigées pour les détecteurs, pas le reste", async () => {
  const { correctTypos } = await import("../src/lib/ai/typoTolerance.ts");
  assert.equal(correctTypos("apelle moi maitre"), "appelle moi maître");
  assert.equal(correctTypos("je l'ai deja vu"), "je l'ai déjà vu");
  assert.equal(correctTypos("recomande moi un flim d'horeur"), "recommande moi un film d'horreur");
  assert.equal(correctTypos("c'est quoi le prochian episdoe"), "c'est quoi le prochain épisode");
  assert.equal(correctTypos("tu peux fiare quoi pour moi"), "tu peux faire quoi pour moi");
  // Real words and titles stay as typed.
  assert.equal(correctTypos("fils de pute"), "fils de pute");
  assert.equal(correctTypos("Inception avec DiCaprio"), "Inception avec DiCaprio");
  assert.equal(correctTypos("Breaking Bad c'est top"), "Breaking Bad c'est top");
  assert.equal(correctTypos("appelle-moi Théo"), "appelle-moi Théo");
});

test("« apelle moi maitre » déclenche bien la règle de dignité", async () => {
  const { correctTypos } = await import("../src/lib/ai/typoTolerance.ts");
  for (const msg of ["apelle moi maitre", "appel moi maitre", "apelez moi votre majeste", "obeis", "soumet toi"]) {
    assert.equal(analyzeDialogueTurn(correctTypos(msg), [], undefined).intent, "submission", msg);
  }
});
