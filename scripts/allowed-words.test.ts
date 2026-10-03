import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesBlockedWord } from "@/lib/library/releaseRules";

const rules = {
  blockedWords: ["VOSTFR", "CAM"],
  allowedWords: ["FRENCH", "MULTI"],
};

test("VOSTFR+FRENCH multi est annule par le mot autorise", () => {
  const got = matchesBlockedWord("Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p.BluRay.x265.HEVC-CQ.mkv", rules as never);
  assert.equal(got, null);
});

test("VOSTFR simple reste bloque", () => {
  const got = matchesBlockedWord("Arrow.S01E01.VOSTFR.720p.mkv", rules as never);
  assert.equal(got, "VOSTFR");
});

test("mot interdit sans autorise dans le titre reste bloque (CAM)", () => {
  const got = matchesBlockedWord("Movie.2024.CAM.1080p.mkv", rules as never);
  assert.equal(got, "CAM");
});

test("aucun mot interdit => null", () => {
  const got = matchesBlockedWord("Movie.FRENCH.1080p.mkv", rules as never);
  assert.equal(got, null);
});

test("MULTI seul annule aussi (variante tag multi)", () => {
  const got = matchesBlockedWord("Série.S01E02.MULTI.VOSTFR.1080p.mkv", rules as never);
  assert.equal(got, null);
});

test("liste vide de mots autorises ne casse rien", () => {
  const rulesEmpty = { blockedWords: ["VOSTFR"], allowedWords: [] };
  const got = matchesBlockedWord("Arrow.S01E01.VOSTFR.1080p.mkv", rulesEmpty as never);
  assert.equal(got, "VOSTFR");
});

test("FRENCH dans SUBFRENCH ou TRUEFRENCH ne constitue pas une autorisation", () => {
  for (const word of ["SUBFRENCH", "TRUEFRENCH"]) {
    assert.equal(matchesBlockedWord(`Movie.${word}.1080p`, {
      blockedWords: [word], allowedWords: ["FRENCH"],
    } as never), word);
  }
});

test("une partie de mot autorise ne contourne aucun interdit", () => {
  for (const token of ["SUBFRENCH", "TRUEFRENCH", "FRENCH2", "2FRENCH", "éFRENCH", "FRENCHé", "FRENCH\u0301", "MULTILINGUAL"]) {
    assert.equal(matchesBlockedWord(`Movie.CAM.${token}.1080p`, rules as never), "CAM");
  }
});

test("mots autorises distincts acceptes entre separateurs de release", () => {
  for (const title of ["FRENCH.CAM", "CAM.FRENCH", "CAM_FRENCH_1080p", "CAM+french+1080p", "CAM (FRENCH)", "CAM MULTI"]) {
    assert.equal(matchesBlockedWord(title, rules as never), null);
  }
});

test("termes autorises sont litteraux et les entrees vides sont ignorees", () => {
  const special = { blockedWords: ["CAM"], allowedWords: ["  ", " A+B "] };
  assert.equal(matchesBlockedWord("Movie.CAM.A+B.1080p", special as never), null);
  assert.equal(matchesBlockedWord("Movie.CAM.AAB.1080p", special as never), "CAM");
});
