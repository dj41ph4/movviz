import assert from "node:assert/strict";
import test from "node:test";
import { aiLanguageInstruction, resolveAiLocale, tmdbLanguage } from "../src/lib/ai/responseLanguage.ts";

test("AI follows a clear message language while short replies keep the profile language", () => {
  assert.equal(resolveAiLocale("fr", "What movie should I watch tonight?"), "en");
  assert.equal(resolveAiLocale("en", "Quel film regarder ce soir ?"), "fr");
  assert.equal(resolveAiLocale("en", "Yes"), "en");
  assert.equal(resolveAiLocale("it", "Dune"), "it");
});

test("une demande française tapée vite garde le français même si le compte est en allemand", () => {
  assert.equal(resolveAiLocale("de", "donne moi des film belge du premier janvier 2025 au 31 decembre 2025"), "fr");
  assert.equal(resolveAiLocale("de", "Propose moi 10 films de production Belges du 1er janvier 2025 à aujourd'hui"), "fr");
  assert.equal(resolveAiLocale("fr", "gib mir einen Film von Januar 2025"), "de");
  assert.equal(resolveAiLocale("fr", "give me some movies from January 2025"), "en");
  assert.equal(resolveAiLocale("de", "Dune"), "de");
});

test("all interface languages have a prompt and official TMDb title locale", () => {
  for (const locale of ["fr", "en", "it", "nl", "de"] as const) {
    assert.match(aiLanguageInstruction(locale), /account's selected language/);
    assert.match(tmdbLanguage(locale), /^[a-z]{2}-[A-Z]{2}$/);
  }
});
