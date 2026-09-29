import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAiReply, emphasizedTitles, userExpressedRating } from "@/lib/ai/replyPresentation";
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
