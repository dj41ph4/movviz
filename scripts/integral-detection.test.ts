import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCompleteSeriesPackTitle, extractSeasonRange } from "@/lib/library/autoGrabSeries";
import { parseRelease } from "@/lib/naming/parser";
import { COMPLETE_SERIES_TERMS } from "@/lib/indexers/torznab";

test("intégrale détectée par nom seul + mot-clé français", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.Intégrale.1080p.mkv", 10), true);
  assert.equal(isCompleteSeriesPackTitle("My Show - Intégrale - 1080p", 10), true);
});

test("intégrale détectée par mot-clé anglais", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.Complete.Series.1080p.mkv", 10), true);
  assert.equal(isCompleteSeriesPackTitle("My.Show.Complete.1080p.mkv", 10), true);
});

test("intégrale détectée par mots-clés multi-langues", () => {
  const cases: [string, number][] = [
    ["My.Show.Saisons Complètes.1080p.mkv", 10],
    ["My.Show.Komplette.Serie.1080p.mkv", 10],
    ["My.Show.Temporadas.Completas.1080p.mkv", 10],
    ["My.Show.Alle.Staffeln.1080p.mkv", 10],
    ["My.Show.Wszystkie.Sezony.1080p.mkv", 10],
    ["My.Show.Pełna.Seria.1080p.mkv", 10],
    ["My.Show.Complete.Season.1080p.mkv", 10],
    ["My.Show.Complete.Boxset.1080p.mkv", 10],
    ["My.Show.Collection.Complète.1080p.mkv", 10],
  ];
  for (const [title, seasons] of cases) {
    assert.equal(isCompleteSeriesPackTitle(title, seasons), true, `devrait être intégrale: ${title}`);
  }
});

test("pack de saison taggé Complete n'est PAS une intégrale (garde-fou épisode)", () => {
  const guard = (title: string) => isCompleteSeriesPackTitle(title, 10, undefined, parseRelease(title).episode, parseRelease(title).season);
  assert.equal(guard("My.Show.S01E01-S01E24.Complete.1080p.mkv"), false);
  assert.equal(guard("My.Show.S04E01-E24.Complete.1080p.mkv"), false);
});

test("pack de SAISON taggé Complete sans plage n'est PAS une intégrale (garde-fou saison)", () => {
  const guard = (title: string) => isCompleteSeriesPackTitle(title, 10, undefined, parseRelease(title).episode, parseRelease(title).season);
  assert.equal(guard("My.Show.S03.Complete.1080p.mkv"), false);
  assert.equal(guard("My.Show.Complete.Season.1.1080p.mkv"), false);
  assert.equal(guard("My.Show.S02.Saison.Complète.1080p.mkv"), false);
  // Sans numéro de saison ni plage, "Complete.Season(s)" reste ambigu — un vrai
  // intégrale "Show.Complete.Seasons" doit continuer de passer.
  assert.equal(guard("My.Show.Complete.Seasons.1080p.mkv"), true);
});

test("plage de saisons couvrant la série = intégrale", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S28.1080p.mkv", 28), true);
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01 à S28.1080p.mkv", 28), true);
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S28.Complete.1080p.mkv", 28), true);
});

test("plage partielle ne couvrant pas la série = PAS une intégrale", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S04.1080p.mkv", 10), false);
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S02.Complete.1080p.mkv", 10), false);
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S28.1080p.mkv", 30), false);
});

test("épisode seul sans marqueur = PAS une intégrale", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01E01.1080p.mkv", 10), false);
});

test("targetSeasons: l'intégrale doit couvrir au moins une saison cible", () => {
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S28.1080p.mkv", 28, [29]), false);
  assert.equal(isCompleteSeriesPackTitle("My.Show.S01-S28.1080p.mkv", 28, [27]), true);
  assert.equal(isCompleteSeriesPackTitle("My.Show.Intégrale.1080p.mkv", 30, [29]), true);
});

test("extractSeasonRange", () => {
  assert.deepEqual(extractSeasonRange("My.Show.S01 à S28.1080p.mkv"), { lo: 1, hi: 28 });
  assert.deepEqual(extractSeasonRange("My.Show.S01-S13.1080p.mkv"), { lo: 1, hi: 13 });
  assert.equal(extractSeasonRange("My.Show.Complete.1080p.mkv"), null);
  assert.equal(extractSeasonRange("My.Show.S01E01.1080p.mkv"), null);
  assert.equal(extractSeasonRange("My.Show.S04-S02.1080p.mkv"), null);
});

function extractRegexLiteral(filePath: string, constName: string): RegExp {
  const src = readFileSync(filePath, "utf8");
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*(/[^/]+/[a-z]*);`, "s");
  const m = src.match(re);
  assert.ok(m, `const ${constName} introuvable dans ${filePath}`);
  const lit = m[1];
  const lastSlash = lit.lastIndexOf("/");
  return new RegExp(lit.slice(1, lastSlash), lit.slice(lastSlash + 1));
}

const PACK_CORPUS = [
  "My.Show.Complete.Series.1080p.mkv",
  "My.Show.Complete.1080p.mkv",
  "My.Show.Complete.Collection.1080p.mkv",
  "My.Show.Complete.Box.Set.1080p.mkv",
  "My.Show.Full.Series.1080p.mkv",
  "My.Show.Entire.Series.1080p.mkv",
  "My.Show.All.Seasons.1080p.mkv",
  "My.Show.Series.Complete.1080p.mkv",
  "My.Show.The.Complete.Series.1080p.mkv",
  "My.Show.Intégrale.1080p.mkv",
  "My.Show.Intégrale.Complète.1080p.mkv",
  "My.Show.Integrale.1080p.mkv",
  "My.Show.Saisons.Complètes.1080p.mkv",
  "My.Show.Collection.Complète.1080p.mkv",
  "My.Show.Série.Complète.1080p.mkv",
  "My.Show.Coffret.Intégral.1080p.mkv",
  "My.Show.Toutes.Les.Saisons.1080p.mkv",
  "My.Show.Complet.1080p.mkv",
  "My.Show.Serie.Completa.1080p.mkv",
  "My.Show.Temporadas.Completas.1080p.mkv",
  "My.Show.Colección.Completa.1080p.mkv",
  "My.Show.Todos.Los.Episodios.1080p.mkv",
  "My.Show.Coleção.Completa.1080p.mkv",
  "My.Show.Complete.Serie.1080p.mkv",
  "My.Show.Compleet.1080p.mkv",
  "My.Show.Volledige.Serie.1080p.mkv",
  "My.Show.Alle.Seizoenen.1080p.mkv",
  "My.Show.Komplette.Serie.1080p.mkv",
  "My.Show.Komplett.1080p.mkv",
  "My.Show.Komplettbox.1080p.mkv",
  "My.Show.Alle.Staffeln.1080p.mkv",
  "My.Show.Komplette.Sammlung.1080p.mkv",
  "My.Show.Wszystkie.Sezony.1080p.mkv",
  "My.Show.Pełna.Seria.1080p.mkv",
  "My.Show.Kompletna.Seria.1080p.mkv",
  "My.Show.S01E01.1080p.mkv",
  "My.Show.S03.1080p.mkv",
  "My.Show.2024.1080p.mkv",
  "My.Show.1080p.WEB-DL.x264.mkv",
];

test("parité PACK_DESC_RE: parser.ts (source de vérité) vs releaseMatchWorker.mjs (miroir)", () => {
  const parserRe = extractRegexLiteral(resolve("src/lib/naming/parser.ts"), "PACK_DESC_RE");
  const workerRe = extractRegexLiteral(resolve("src/lib/workers/releaseMatchWorker.mjs"), "PACK_DESC_RE");
  assert.equal(parserRe.source, workerRe.source, "les littéraux PACK_DESC_RE divergent");
  for (const title of PACK_CORPUS) {
    assert.equal(parserRe.test(title), workerRe.test(title), `désaccord parité sur: ${title}`);
  }
});

test("parseRelease.isCompletePack cohérent avec PACK_DESC_RE du parser", () => {
  const parserRe = extractRegexLiteral(resolve("src/lib/naming/parser.ts"), "PACK_DESC_RE");
  for (const title of PACK_CORPUS) {
    const parsed = parseRelease(title);
    const flagged = parsed.isCompletePack === true;
    const reMatch = parserRe.test(title);
    assert.equal(flagged, reMatch, `parseRelease.isCompletePack ≠ PACK_DESC_RE sur: ${title}`);
  }
});

test("chaque terme de COMPLETE_SERIES_TERMS (torznab) est détecté par PACK_DESC_RE (parser)", () => {
  const parserRe = extractRegexLiteral(resolve("src/lib/naming/parser.ts"), "PACK_DESC_RE");
  for (const term of COMPLETE_SERIES_TERMS) {
    const title = `My.Show.${term.replace(/\s+/g, ".")}.1080p.mkv`;
    assert.equal(parserRe.test(title), true, `terme non couvert par PACK_DESC_RE: "${term}"`);
    assert.equal(isCompleteSeriesPackTitle(title, 10), true, `terme non détecté par isCompleteSeriesPackTitle: "${term}"`);
  }
});
