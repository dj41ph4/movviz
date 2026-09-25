import test from "node:test";
import assert from "node:assert/strict";
import { detectSeenCommand, isDirectRecommendationRequest, buildQuickReplies, recommendationIntro, extractSuggestedTitle, proposedKeys, lastRecommendations } from "@/lib/ai/chatAssist";
import type { AiChatMessage, AiRecommendation } from "@/lib/ai/types";

// Phrases from a real conversation where the assistant asked for
// confirmation three times before showing a single card.

test("« mets-le en vu » targets the title being discussed; « j'ai déjà tout vu » the last cards", () => {
  assert.equal(detectSeenCommand("deja vu, d'ailleurs tu peux le mettre en vu si c'est pas encore fait"), "subject");
  assert.equal(detectSeenCommand("marque-la comme vue"), "subject");
  assert.equal(detectSeenCommand("j'ai deja tout vu..."), "all_last");
  assert.equal(detectSeenCommand("je les ai tous vus"), "all_last");
  assert.equal(detectSeenCommand("j'ai pas tout vu"), null);
  assert.equal(detectSeenCommand("tu l'as vu toi ?"), null);
});

test("a request for titles, or a short answer to an offer, means cards now", () => {
  assert.equal(isDirectRecommendationRequest("tu me conseillerai quoi ?"), true);
  assert.equal(isDirectRecommendationRequest("dans le meme genre"), true);
  assert.equal(isDirectRecommendationRequest("tu sais ce que j'aime ^^"), true);
  assert.equal(isDirectRecommendationRequest("vas y", "Tu veux que je t'envoie une liste de suggestions dans ce style pour que tu pioches dedans ? 🔥"), true);
  assert.equal(isDirectRecommendationRequest("animation", "On reste sur de l'animation bien sauvage avec des combats qui envoient du lourd, ou tu veux tenter une grosse surprise sombre sur un format différent ? 😉"), true);
  assert.equal(isDirectRecommendationRequest("oui", "Ça te tente, ou tu cherches plutôt un film ce soir ? 👀"), true);
});

test("reactions, refusals and small talk are not recommendation requests", () => {
  assert.equal(isDirectRecommendationRequest("tu m'as recommandé Dune, c'était nul"), false);
  assert.equal(isDirectRecommendationRequest("à propos de ce film, qui joue dedans ?"), false);
  assert.equal(isDirectRecommendationRequest("j'aime pas ce genre de truc"), false);
  assert.equal(isDirectRecommendationRequest("non merci", "Tu veux que je te sorte une sélection de films ?"), false);
  assert.equal(isDirectRecommendationRequest("biensur", "Tu testes mes réflexes après la mise à jour ou tu as une vraie idée de film en tête pour ce soir, Seb ? 🎬"), false);
  assert.equal(isDirectRecommendationRequest("haha ok", "Tu as vu quel film récemment ?"), false);
});

const card = (tmdbId: number, type: "movie" | "series", title = `T${tmdbId}`): AiRecommendation => ({
  tmdbId, type, title, overview: "", posterPath: null, rating: 8, inLibrary: false,
});

test("quick replies follow what was just shown", () => {
  const series: AiChatMessage = { role: "assistant", content: "x", recommendations: [card(1, "series"), card(2, "series"), card(3, "movie")] };
  assert.ok(buildQuickReplies(series).includes("Plutôt un film"));
  const movies: AiChatMessage = { role: "assistant", content: "x", recommendations: [card(1, "movie"), card(2, "movie")] };
  assert.ok(buildQuickReplies(movies).includes("Plutôt une série"));
  assert.deepEqual(buildQuickReplies({ role: "assistant", content: "Tu veux que je te sorte une sélection ?" }), ["Vas-y", "Un film", "Une série", "Surprends-moi"]);
  assert.deepEqual(buildQuickReplies({ role: "assistant", content: "Rien ne m'arrête aussi facilement ! 💀" }), []);
});

test("the model's own intro wins; the fallback never repeats the previous opening", () => {
  assert.equal(recommendationIntro("Accroche-toi, ça tranche.", []), "Accroche-toi, ça tranche.");
  for (let i = 0; i < 20; i++) {
    assert.notEqual(recommendationIntro(undefined, ["Tiens, voilà de quoi faire : bla"]), "Tiens, voilà de quoi faire :");
  }
});

test("a title put forward in plain text becomes the subject; cards already shown are remembered", () => {
  assert.equal(extractSuggestedTitle("je verrais bien *Hell's Paradise*. Des criminels…"), "Hell's Paradise");
  assert.equal(extractSuggestedTitle("Regarde « Vinland Saga », tu vas adorer"), "Vinland Saga");
  assert.equal(extractSuggestedTitle("Rien de précis"), null);
  const messages: AiChatMessage[] = [
    { role: "assistant", content: "a", recommendations: [card(10, "series")] },
    { role: "user", content: "b" },
    { role: "assistant", content: "c", recommendations: [card(11, "movie")] },
  ];
  assert.deepEqual([...proposedKeys(messages)], ["series:10", "movie:11"]);
  assert.deepEqual(lastRecommendations(messages).map((r) => r.tmdbId), [11]);
});

test("« tu peux faire quoi pour moi ? » gets the real list of what the assistant does", async () => {
  const { isCapabilitiesQuestion, buildCapabilitiesSection } = await import("@/lib/ai/chatAssist");
  assert.equal(isCapabilitiesQuestion("tu peux faire quoi pour moi ?"), true);
  assert.equal(isCapabilitiesQuestion("qu'est-ce que tu sais faire"), true);
  assert.equal(isCapabilitiesQuestion("tu sers à quoi ?"), true);
  assert.equal(isCapabilitiesQuestion("tu peux me conseiller un film"), false);
  assert.match(buildCapabilitiesSection(true), /musique/);
  assert.doesNotMatch(buildCapabilitiesSection(false), /musique/);
});
