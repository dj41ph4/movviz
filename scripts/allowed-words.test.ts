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
