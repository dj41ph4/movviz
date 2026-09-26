import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildPersonalityBlock } from "../src/lib/ai/actions";
import { buildSystemPromptCompact } from "../src/lib/ai/promptCompact";
import { buildCreatorContext, isCreator } from "../src/lib/ai/creator";

const args = ["ctx", "mem", "usage", "retours", "faits", false, false, "consolidé", "corrections", true] as const;

test("la personnalité est identique au caractère près dans les deux versions du prompt", () => {
  const personality = buildPersonalityBlock("");
  assert.ok(personality.length > 5000);
  assert.ok(buildSystemPrompt(...args).includes(personality));
  assert.ok(buildSystemPromptCompact(...args).includes(personality));
});

test("la version condensée garde les données du compte et les marqueurs, en bien plus court", () => {
  const full = buildSystemPrompt(...args);
  const compact = buildSystemPromptCompact(...args);
  for (const piece of ["ctx", "mem", "usage", "retours", "faits", "consolidé", "corrections", "RECHERCHE WEB : activée", "[[FAIT:", "[[VU:", "[[NOTE:", "add_media", "recommend", "Rengoku", "Beru"]) {
    assert.ok(compact.includes(piece), piece);
  }
  assert.ok(compact.length < full.length * 0.65, `${compact.length} / ${full.length}`);
});

test("seul le profil dj41ph4 est reconnu comme le créateur", () => {
  assert.equal(isCreator("dj41ph4"), true);
  assert.equal(isCreator("DJ41PH4"), true);
  assert.equal(isCreator("test"), false);
  assert.match(buildCreatorContext("dj41ph4"), /tu parles à Seb/);
  assert.match(buildCreatorContext("test"), /ce n'est pas la personne à qui tu parles/);
});
