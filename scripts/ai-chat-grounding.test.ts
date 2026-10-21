import test from "node:test";
import assert from "node:assert/strict";
import { asksForWebVerification, chatTitleQuery, factualWebContext, factualWebPrompt, resolveChatTitle, selectChatTitle, titleKey } from "../src/lib/ai/chatGrounding";
import type { AiChatMessage } from "../src/lib/ai/types";
import type { ResolvedTitleItem } from "../src/lib/metadata/resolveTitle";

const marvel: ResolvedTitleItem = { title: "VisionQuest", type: "series", year: 2026, tmdbId: 213375, overview: "La suite de WandaVision.", posterPath: null, rating: 8, inLibrary: true };
const movie: ResolvedTitleItem = { ...marvel, title: "Vision Quest", type: "movie", year: 1985, tmdbId: 30069, inLibrary: false };
const wrong: ResolvedTitleItem = { ...movie, title: "Vision Video", year: 2024, tmdbId: 1259089 };
const history = (...texts: string[]): AiChatMessage[] => texts.map((content) => ({ role: "user", content }));

test("Vision Quest et Visionquest identifient la série présente, sans confondre Vision Video", () => {
  assert.equal(titleKey("Vision Quest"), titleKey("VisionQuest"));
  assert.equal(selectChatTitle({ title: "vision quest" }, [movie, wrong, marvel])?.type, "series");
  assert.equal(selectChatTitle({ title: "visionquest", type: "series", year: 2026 }, [movie, wrong, marvel])?.tmdbId, marvel.tmdbId);
  assert.equal(selectChatTitle({ title: "visionquest", type: "series", year: 2026 }, [movie, wrong]), null);
  assert.equal(selectChatTitle({ title: "visionquest" }, [wrong]), null);
});

test("les homonymes sans contrainte restent ambigus, les années et types sont stricts", () => {
  assert.equal(selectChatTitle({ title: "Vision Quest" }, [movie, { ...marvel, inLibrary: false }]), null);
  assert.equal(selectChatTitle({ title: "Vision Quest", type: "series" }, [movie]), null);
  assert.equal(selectChatTitle({ title: "Vision Quest", year: 2026 }, [movie]), null);
  assert.equal(selectChatTitle({ title: "Vision Quest", type: "movie", year: 1985 }, [movie, marvel])?.tmdbId, 30069);
});

test("une correspondance locale exacte ne dépend ni du réseau ni du premier résultat TMDb", async () => {
  let calls = 0;
  const resolved = await resolveChatTitle({ title: "vision quest" }, { library: () => [marvel], search: async () => { calls++; throw Error("offline"); } });
  assert.equal(resolved?.tmdbId, marvel.tmdbId);
  assert.equal(calls, 0);
});

test("TMDb ne peut pas annuler une correction de type ou d'année", async () => {
  let searched = "";
  const resolved = await resolveChatTitle({ title: "visionquest", type: "series", year: 2026 }, {
    library: () => [], search: async (title) => { searched = title; return [movie, wrong, { ...marvel, inLibrary: false }]; },
  });
  assert.equal(searched, "visionquest");
  assert.equal(resolved?.type, "series");
  assert.equal(resolved?.inLibrary, false);
});

test("rejeu du dialogue : corrections et année restent attachées à VisionQuest", () => {
  const turns: AiChatMessage[] = [];
  for (const message of ["vision quest", "non visionquest", "t'es debile ou quoi? c'est du marvel", "sorti en 2026", "t'es pas a jour en fait, visionquest est la suite de wandavision, il est meme dans ma bibliotheque", "il est sorti, va sur le net verifier", "et donc visionquest doit sortir quand ?", "ben tu va mettre a jour ta base de donnée immediatement"]) {
    turns.push({ role: "user", content: message });
    const query = chatTitleQuery(message, turns, { title: "Vision Quest", type: "movie", year: 1985 });
    assert.ok(query, message);
    assert.equal(titleKey(query.title), "visionquest", message);
    assert.notEqual(query.year, 1985, "assistant error must not become a constraint");
    if (message === "sorti en 2026") assert.equal(query.year, 2026);
    if (message.includes("va sur le net") || message.includes("doit sortir")) assert.equal(query.verifyOnline, true);
    // Wrong assistant messages never enter the evidence chain.
    turns.push({ role: "assistant", content: "Vision Quest (1985) avec Matthew Modine, ou Vision Video (2024) !" });
  }
});

test("un nouveau titre quitte le précédent, une réaction courante ne déclenche pas de recherche", () => {
  assert.equal(chatTitleQuery("Alien", history("Visionquest", "sorti en 2026"))?.year, undefined);
  for (const message of ["merci", "c'est quoi la date du jour ?", "tu me conseilles quoi ?"]) assert.equal(chatTitleQuery(message, [], null), null, message);
  const query = chatTitleQuery("non visionquest", history("la série visionquest", "sorti en 2026"));
  assert.equal(query?.type, "series");
  assert.equal(query?.year, 2026);
});

test("les demandes web lancent une vérification actuelle, pas une promesse ni une fausse mise à jour", () => {
  for (const message of ["il est sorti, va sur le net verifier", "cherche sur internet", "vérifie en ligne la date de sortie", "consulte les sources"]) assert.equal(asksForWebVerification(message), true, message);
  assert.equal(asksForWebVerification("je regarde un film"), false);
  const prompt = factualWebPrompt("vérifie sa sortie", marvel, "2026-10-21");
  assert.match(prompt, /2026-10-21/);
  assert.match(prompt, /VisionQuest \(série\), 2026/);
  const result = factualWebContext("Sortie : 14 octobre 2026. Source : https://www.marvel.com/", true);
  assert.match(result, /https:\/\/www.marvel.com/);
  assert.match(result, /Aucun changement de la bibliothèque/);
  assert.match(factualWebContext(null, false), /désactivée/);
  assert.match(factualWebContext(null, true), /pas fourni de résultat/);
});
