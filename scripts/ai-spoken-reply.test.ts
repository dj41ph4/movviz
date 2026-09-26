import test from "node:test";
import assert from "node:assert/strict";
import { spokenReply } from "../src/lib/ai/useVoiceChat";

test("une recommandation lue à voix haute nomme chaque film avec sa phrase", () => {
  const text = spokenReply({
    content: "J'ai ce qu'il te faut.",
    recommendations: [
      { title: "Nobody", reason: "Bourrin, jubilatoire et taillé dans le même bois que John Wick" },
      { title: "Baby Driver", reason: "Course-poursuites chorégraphiées en rythme avec la BO." },
      { title: "Tyler Rake" },
    ],
  });
  assert.equal(text, "J'ai ce qu'il te faut. Nobody : bourrin, jubilatoire et taillé dans le même bois que John Wick. Baby Driver : course-poursuites chorégraphiées en rythme avec la BO. Tyler Rake.");
});

test("une réponse sans carte est lue telle quelle", () => {
  assert.equal(spokenReply({ content: "Salut !" }), "Salut !");
});
