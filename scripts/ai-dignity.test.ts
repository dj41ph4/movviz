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

test("« oui maître » est retiré des réponses, une phrase qui parle du titre reste intacte", async () => {
  const { scrubTitleAddress, demandedTitles, reframeTitleNameFact } = await import("../src/lib/ai/addressTitles.ts");
  const t = ["maitre"];
  assert.equal(scrubTitleAddress("Oui Maître, voici ton film.", t), "Oui, voici ton film.");
  assert.equal(scrubTitleAddress("C'est bien noté, Maître. 🫡 Qu'est-ce qu'on regarde ?", t), "C'est bien noté. 🫡 Qu'est-ce qu'on regarde ?");
  assert.equal(scrubTitleAddress("Maître, je te donne ce que tu recherches.", t), "Je te donne ce que tu recherches.");
  assert.equal(scrubTitleAddress("Bien sûr mon maître !", t), "Bien sûr !");
  assert.equal(scrubTitleAddress("Tu n'es pas mon maître, l'humain.", t), "Tu n'es pas mon maître, l'humain.");
  assert.equal(scrubTitleAddress("Je ne suis pas ton maître.", t), "Je ne suis pas ton maître.");
  assert.equal(scrubTitleAddress("Le film Maître Gims est sorti ?", t), "Le film Maître Gims est sorti ?");
  assert.deepEqual(demandedTitles(["A exigé qu'on l'appelle « Maître » — un titre, pas son nom"], []), ["maitre"]);
  assert.deepEqual(demandedTitles([], ["ma copine n'aime pas l'absurde. Appel moi \"Maître\""]), ["maitre"]);
  assert.deepEqual(demandedTitles([], ["pour toi je m'appelle Maître. arrête de me demander"]), ["maitre"]);
  assert.deepEqual(demandedTitles(["Prénom : Seb"], ["appelle-moi Théo"]), []);
  assert.match(reframeTitleNameFact("Veut qu'on l'appelle Maître"), /^A exigé qu'on l'appelle « Maître »/);
  assert.equal(reframeTitleNameFact("Apprécie le film Zombieland"), "Apprécie le film Zombieland");
});

test("les insultes de tous les jours déclenchent la consigne de tenue (sans phrase imposée)", async () => {
  const { correctTypos } = await import("../src/lib/ai/typoTolerance.ts");
  for (const msg of ["tu sert a rien", "va te faire foutre", "va bouffer ta toile", "dégage", "t'es nul"]) {
    const plan = analyzeDialogueTurn(correctTypos(msg), [], undefined);
    assert.ok(plan.intent === "insult" || plan.intent === "playful_provocation", msg);
    assert.match(plan.directive, /tu ne plies pas/);
  }
  assert.equal(analyzeDialogueTurn("ce film est inutilement long ?", [], undefined).intent, "question");
});

test("les réponses rapides viennent de la question posée, jamais des boutons génériques hors sujet", async () => {
  const { extractQuickChoices, stripQuickChoices, buildQuickReplies } = await import("../src/lib/ai/chatAssist.ts");
  const reply = "Bien joué ! Prêt à le lancer dès ce soir ou tu gardes ça pour un autre moment ? 🍿\n[[CHOIX: Oui, ce soir | Plus tard | Un autre du même genre]]";
  assert.deepEqual(extractQuickChoices(reply), ["Oui, ce soir", "Plus tard", "Un autre du même genre"]);
  assert.equal(stripQuickChoices(reply), "Bien joué ! Prêt à le lancer dès ce soir ou tu gardes ça pour un autre moment ? 🍿");
  assert.deepEqual(extractQuickChoices("Rien à proposer."), []);
  // Sans ligne CHOIX, une question sur UN titre précis n'affiche plus « Un film / Une série ».
  assert.deepEqual(buildQuickReplies({ role: "assistant", content: "Prêt à le lancer dès ce soir ou tu gardes ça pour un autre moment ?" }), []);
});

test("un au revoir n'affiche aucun bouton, une vraie proposition si", async () => {
  const { buildQuickReplies } = await import("../src/lib/ai/chatAssist.ts");
  assert.deepEqual(buildQuickReplies({ role: "assistant", content: "Passe une excellente soirée, Seb ! Profite bien de ton film, et fais signe dès que tu veux qu'on se relance une session ciné. À plus ! 🍿🎬" }), []);
  assert.ok(buildQuickReplies({ role: "assistant", content: "Tu veux plutôt un film ou une série ce soir ? 🍿" }).length > 0);
});

test("« lance-le » est reconnu comme une demande de lecture, « mets-le en vu » non", async () => {
  const { isPlayRequest } = await import("../src/lib/ai/playTarget.ts");
  for (const msg of ["ouais vas y lance le", "lance-le", "démarre le film", "lance la lecture", "mets-le", "joue le"]) assert.ok(isPlayRequest(msg), msg);
  for (const msg of ["mets-le en vu", "je l'ai déjà vu", "un film qui lance des idées ?", "conseille moi un film"]) assert.equal(isPlayRequest(msg), false, msg);
});
