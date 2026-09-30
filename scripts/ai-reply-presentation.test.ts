import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAiReply, emphasizedTitles, userExpressedRating, extractListedRecommendations, matchHistoryRecommendationCards } from "@/lib/ai/replyPresentation";
import { extractQuickChoices, stripQuickChoices } from "@/lib/ai/chatAssist";

test("an escaped rating prompt shows prose and clickable choices without saving a guessed rating", () => {
  const raw = "Salut Seb ! Tu lui mettrais combien à \\*Spider-Man : No Way Home\\* ? \\[\\[NOTE: Spider-Man : No Way Home|movie|5\\]\\] \\[\\[CHOIX: 5 sur 5 | Plutôt 4 | Un bon 3\\]\\]";
  const normalized = raw.replace(/\\([\[\]])/g, "$1");
  assert.deepEqual(extractQuickChoices(normalized), ["5 sur 5", "Plutôt 4", "Un bon 3"]);
  assert.equal(cleanAiReply(stripQuickChoices(normalized)), "Salut Seb ! Tu lui mettrais combien à *Spider-Man : No Way Home* ?");
  assert.deepEqual(emphasizedTitles(cleanAiReply(raw)), ["Spider-Man : No Way Home"]);
  assert.equal(userExpressedRating("Tu as vu Spider-Man récemment ?"), false);
  assert.equal(userExpressedRating("J'ai adoré Spider-Man"), true);
  assert.equal(userExpressedRating("Je lui mets 4 sur 5"), true);
  assert.equal(userExpressedRating("Un bon 3, sans plus"), true);
});

test("unknown internal markers never become visible prose", () => {
  assert.equal(cleanAiReply("Oui. [[FAIT: préfère les thrillers]] [[VU: Alien|movie]]"), "Oui.");
});

test("a numbered recommendation history block becomes card items and stays hidden from prose", () => {
  const raw = "Un bon polar sombre :\n[Cartes proposées dans ce message :\n1. Se7en (1995), film\n2. Zodiac (2007), film\n3. Prisoners (2013), film]";
  const recovered = extractListedRecommendations(raw);
  assert.ok(recovered);
  assert.equal(recovered.fromHistory, true);
  assert.deepEqual(recovered.items.map((item) => item.title), ["Se7en", "Zodiac", "Prisoners"]);
  assert.equal(cleanAiReply(raw), "Un bon polar sombre :");
  const cards = recovered.items.map((item, index) => ({ ...item, type: item.type!, tmdbId: index + 1, overview: "", posterPath: null, rating: 8, inLibrary: false }));
  const history = [{ role: "assistant" as const, content: "Voici les cartes", recommendations: cards }];
  assert.deepEqual(matchHistoryRecommendationCards(recovered.items, history).map((card) => card.tmdbId), [1, 2, 3]);
});
