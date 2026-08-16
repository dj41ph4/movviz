import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "@/lib/ai/intentParser";

test("add_media JSON seul dans la réponse", () => {
  const got = parseIntent('{"action":"add_media","items":[{"title":"Justice League: War","year":2014,"type":"movie"}]}');
  assert.equal(got.action, "add_media");
  assert.equal(got.items.length, 1);
  assert.equal(got.items[0].title, "Justice League: War");
  assert.equal(got.items[0].year, 2014);
  assert.equal(got.items[0].type, "movie");
  assert.equal(got.rawText, "");
});

test("recommend avec reasons", () => {
  const got = parseIntent('{"action":"recommend","items":[{"title":"Naked Gun","year":1988,"type":"movie","reason":"Même humour absurde"}]}');
  assert.equal(got.action, "recommend");
  assert.equal(got.items[0].reason, "Même humour absurde");
});

test("JSON entouré de prose et fences markdown", () => {
  const got = parseIntent('Voici ce que je propose :\n```json\n{"action":"recommend","items":[{"title":"Airplane!"}]}\n```\nJ\'espère que ça t\'aide !');
  assert.equal(got.action, "recommend");
  assert.equal(got.items[0].title, "Airplane!");
  assert.ok(got.rawText.includes("Voici ce que je propose"));
  assert.ok(got.rawText.includes("J'espère que ça t'aide !"));
});

test("items invalides sont écartés (title vide), champs invalides ignorés (type inconnu, year hors bornes)", () => {
  const got = parseIntent('{"action":"add_media","items":[{"title":"","year":1700,"type":"movie"},{"title":"Bon","year":2500,"type":"documentary"},{"title":"OK","year":1990,"type":"series"}]}');
  assert.equal(got.action, "add_media");
  assert.equal(got.items.length, 2);
  assert.equal(got.items[0].title, "Bon");
  assert.equal(got.items[0].year, undefined);
  assert.equal(got.items[0].type, undefined);
  assert.equal(got.items[1].title, "OK");
  assert.equal(got.items[1].year, 1990);
  assert.equal(got.items[1].type, "series");
});

test("cap à 25 items", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ title: `Film ${i}`, type: "movie" }));
  const got = parseIntent(JSON.stringify({ action: "add_media", items }));
  assert.equal(got.items.length, 25);
});

test("pas de JSON => action null", () => {
  const got = parseIntent("Je suis un simple message texte, rien à faire ici.");
  assert.equal(got.action, null);
  assert.equal(got.items.length, 0);
  assert.equal(got.rawText, "Je suis un simple message texte, rien à faire ici.");
});

test("JSON sans action => null", () => {
  const got = parseIntent('{"foo":"bar"}');
  assert.equal(got.action, null);
});

test("texte hors JSON bien extrait dans rawText", () => {
  const got = parseIntent('D\'accord, voilà : {"action":"add_media","items":[{"title":"Batman: Hush"}]} C\'est fait !');
  assert.equal(got.action, "add_media");
  assert.ok(got.rawText.includes("D'accord, voilà"));
  assert.ok(got.rawText.includes("C'est fait !"));
  assert.equal(got.items[0].title, "Batman: Hush");
});

test("title trop long ( > 200) est écarté", () => {
  const long = "X".repeat(300);
  const got = parseIntent(JSON.stringify({ action: "add_media", items: [{ title: long }] }));
  assert.equal(got.items.length, 0);
  assert.equal(got.action, null);
});