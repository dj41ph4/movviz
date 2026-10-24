import assert from "node:assert/strict";
import test from "node:test";
import { aiLanguageInstruction, resolveAiLocale, tmdbLanguage } from "../src/lib/ai/responseLanguage.ts";

test("AI follows a clear message language while short replies keep the profile language", () => {
  assert.equal(resolveAiLocale("fr", "What movie should I watch tonight?"), "en");
  assert.equal(resolveAiLocale("en", "Quel film regarder ce soir ?"), "fr");
  assert.equal(resolveAiLocale("en", "Yes"), "en");
  assert.equal(resolveAiLocale("it", "Dune"), "it");
});

test("all interface languages have a prompt and official TMDb title locale", () => {
  for (const locale of ["fr", "en", "it", "nl", "de"] as const) {
    assert.match(aiLanguageInstruction(locale), /account's selected language/);
    assert.match(tmdbLanguage(locale), /^[a-z]{2}-[A-Z]{2}$/);
  }
});
