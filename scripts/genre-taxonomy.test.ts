import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAnimeByIds, matchesTeenByIds, matchesAnimeByNames, matchesTeenByNames } from "@/lib/metadata/genreTaxonomy";

test("matchesAnimeByIds : un titre japonais avec le genre Animation matche (Ghibli)", () => {
  assert.equal(matchesAnimeByIds([16, 12], "ja"), true);
});

test("matchesAnimeByIds : une animation occidentale (Pixar) ne matche pas", () => {
  assert.equal(matchesAnimeByIds([16, 10751], "en"), false);
});

test("matchesAnimeByIds : un film japonais non animé ne matche pas", () => {
  assert.equal(matchesAnimeByIds([18], "ja"), false);
});

test("matchesTeenByIds (film) : Romance + Comédie hors Familial matche", () => {
  assert.equal(matchesTeenByIds("movie", [10749, 35]), true);
  assert.equal(matchesTeenByIds("movie", [10749, 18]), true);
});

test("matchesTeenByIds (film) : Romance + Familial (dessin animé romantique jeunesse) ne matche pas", () => {
  assert.equal(matchesTeenByIds("movie", [10749, 35, 10751]), false);
});

test("matchesTeenByIds (film) : Romance seule sans Comédie ni Drame ne matche pas", () => {
  assert.equal(matchesTeenByIds("movie", [10749]), false);
});

test("matchesTeenByIds (série) : Soap seul suffit", () => {
  assert.equal(matchesTeenByIds("series", [10766]), true);
});

test("matchesTeenByIds (série) : Drame + Comédie sans Soap matche aussi", () => {
  assert.equal(matchesTeenByIds("series", [18, 35]), true);
});

test("matchesTeenByIds (série) : Kids exclut même avec Soap", () => {
  assert.equal(matchesTeenByIds("series", [10766, 10762]), false);
});

test("matchesAnimeByNames : hint explicite prime sur l'approximation par genre", () => {
  assert.equal(matchesAnimeByNames(["Animation"], false), false);
  assert.equal(matchesAnimeByNames(["Drame"], true), true);
});

test("matchesAnimeByNames : sans hint, retombe sur le genre Animation (approximation)", () => {
  assert.equal(matchesAnimeByNames(["Animation"], undefined), true);
  assert.equal(matchesAnimeByNames(["Drame"], undefined), false);
});

test("matchesTeenByNames (film/série) : mêmes règles que la version par id, en noms français", () => {
  assert.equal(matchesTeenByNames("movie", ["Romance", "Comédie"]), true);
  assert.equal(matchesTeenByNames("movie", ["Romance", "Comédie", "Familial"]), false);
  assert.equal(matchesTeenByNames("series", ["Soap"]), true);
  assert.equal(matchesTeenByNames("series", ["Drame", "Comédie", "Kids"]), false);
});
