import test from "node:test";
import assert from "node:assert/strict";
import { extractCriteriaRequest, resolveCriteriaRequest } from "@/lib/ai/criteriaRequest";

const NOW = new Date("2026-10-27T10:00:00Z");

test("la demande de la capture 1 : période explicite et production belge", () => {
  const r = extractCriteriaRequest("je cherche un film de production belges sortie entre le 1er Janvier 2025 et le 26 octobre 2026.", NOW);
  assert.deepEqual(r, { scope: "movie", countries: ["BE"], from: "2025-01-01", to: "2026-10-26", count: 10, best: false });
});

test("la demande des captures 2 et 3 : coproduction, « à aujourd'hui », 10 meilleurs", () => {
  for (const m of [
    "Propose moi 10 films de production Belges ou de Coproduction Belges du 1er janvier 2025 à aujourd'hui.\n\nPropose moi les 10 films les mieux noté.",
    "Propose moi 10 films de production Belges ou de Coproduction Belges du 1er janvier 2025 à aujourd'hui. Propose moi les 10 films les mieux noté.",
  ]) {
    assert.deepEqual(extractCriteriaRequest(m, NOW), { scope: "movie", countries: ["BE"], from: "2025-01-01", to: "2026-10-27", count: 10, best: true }, m);
  }
});

test("« depuis », « avant », « en 2025 » et « cette année » bornent la période", () => {
  assert.deepEqual(extractCriteriaRequest("donne-moi des films belges depuis janvier 2025", NOW)?.from, "2025-01-01");
  assert.equal(extractCriteriaRequest("donne-moi des films belges depuis janvier 2025", NOW)?.to, "2026-10-27");
  assert.equal(extractCriteriaRequest("propose des films sortis avant 2010", NOW)?.to, "2010-12-31");
  const y = extractCriteriaRequest("propose-moi des séries coréennes sorties en 2024", NOW);
  assert.deepEqual([y?.scope, y?.countries, y?.from, y?.to], ["series", ["KR"], "2024-01-01", "2024-12-31"]);
  assert.equal(extractCriteriaRequest("propose un film sorti cette année", NOW)?.from, "2026-01-01");
});

test("sans période ni pays de production, ce n'est pas une demande à critères", () => {
  for (const m of [
    "propose-moi un film d'horreur",
    "j'ai regardé un film belge hier",
    "réponds en français et propose un film",
    "un film comme Pulp Fiction de 1994",
    "tu as vu la série belge ?",
    "merci pour les films de 2025",
  ]) {
    assert.equal(extractCriteriaRequest(m, NOW), null, m);
  }
});

test("un reproche court reprend les critères de la dernière vraie demande", () => {
  const earlier = ["bonjour", "je cherche un film de production belges sortie entre le 1er Janvier 2025 et le 26 octobre 2026."];
  const r = resolveCriteriaRequest("tu nas pas respectés mes conditions de recherches", earlier, NOW);
  assert.deepEqual([r?.countries, r?.from, r?.to], [["BE"], "2025-01-01", "2026-10-26"]);
  assert.equal(resolveCriteriaRequest("ti te trompes dans les dates", earlier, NOW)?.from, "2025-01-01");
  assert.equal(resolveCriteriaRequest("tu nas pas respectés mes conditions de recherches", ["bonjour"], NOW), null);
  assert.equal(resolveCriteriaRequest("merci beaucoup", earlier, NOW), null);
});

test("une autre question qui mentionne une date ou la liste ne relance jamais la recherche", () => {
  const earlier = ["je cherche un film de production belges sortie entre le 1er Janvier 2025 et le 26 octobre 2026."];
  for (const m of [
    "quelle est la date de sortie du premier ?",
    "ajoute le premier à ma liste",
    "parle-moi du deuxième",
    "c'est quoi la période de tournage",
    "il est bon celui-là ?",
    "j'ai déjà vu le troisième",
  ]) {
    assert.equal(resolveCriteriaRequest(m, earlier, NOW), null, m);
  }
  // Un vrai reproche sans liste affichée juste avant : rien à reprendre.
  assert.equal(resolveCriteriaRequest("tu te trompes dans les dates", earlier, NOW, false), null);
});
