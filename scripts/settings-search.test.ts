import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fr } from "../src/i18n/locales/fr.ts";
import { SETTINGS_TABS, matchesSettingsQuery, settingsContentSnippet, searchWords, normalizeSearch } from "@/lib/settingsNav";
import { SETTINGS_SEARCH_KEYS } from "@/lib/settingsSearchIndex.generated";
import { buildSettingsSearchIndex, renderIndexFile, INDEX_FILE } from "./settings-search-index.ts";

/** Résolution de clé identique à celle de l'interface (français, clé brute si absente). */
function t(key: string): string {
  let cur: unknown = fr;
  for (const part of key.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[part];
  return typeof cur === "string" ? cur : key;
}
const tab = (id: string) => SETTINGS_TABS.find((x) => x.id === id)!;
const tabsFor = (query: string) => SETTINGS_TABS.filter((x) => matchesSettingsQuery(x, query, t)).map((x) => x.id);

test("l'index généré est à jour avec le code des panneaux (npm run gen:settings-search)", () => {
  // Sous Windows, git peut convertir les fins de ligne : on compare sans elles.
  const onDisk = fs.readFileSync(INDEX_FILE, "utf8").split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
  assert.equal(onDisk, renderIndexFile(buildSettingsSearchIndex()));
});

test("chaque onglet a du contenu indexé, et ses clés existent en français", () => {
  for (const [id, keys] of Object.entries(SETTINGS_SEARCH_KEYS)) {
    assert.ok(keys.length > 0, id);
    for (const k of keys) assert.notEqual(t(k), k, `clé absente : ${k}`);
  }
  for (const tb of SETTINGS_TABS) assert.ok(SETTINGS_SEARCH_KEYS[tb.id]?.length, `onglet sans index : ${tb.id}`);
});

test("un mot du contenu d'un réglage trouve son onglet, pas seulement le titre", () => {
  // « Relance des films manquants » est une tâche affichée dans Automatisation.
  assert.ok(tabsFor("relance").includes("automation"));
  const title = normalizeSearch(t(tab("automation").labelKey) + t(tab("automation").hintKey));
  assert.ok(!title.includes("relance films manquants"), "le titre seul ne suffit pas");
});

test("chaque mot doit trouver quelque chose dans l'onglet, sans ordre ni accent", () => {
  assert.ok(tabsFor("manquants relance").includes("automation"));
  assert.ok(tabsFor("MANQUANTS films").includes("automation"));
  assert.ok(!tabsFor("relance zzzinexistant").length);
});

test("l'extrait montre le réglage trouvé quand le titre ne l'explique pas", () => {
  const snippet = settingsContentSnippet(tab("automation"), "relance", t);
  assert.ok(snippet && normalizeSearch(snippet).includes("relance"), String(snippet));
  assert.equal(settingsContentSnippet(tab("automation"), t(tab("automation").labelKey), t), null);
});

test("une requête vide ou d'une lettre ne casse rien", () => {
  assert.equal(matchesSettingsQuery(tab("plex"), "   ", t), true);
  assert.deepEqual(searchWords("a  relance"), ["relance"]);
  assert.deepEqual(searchWords("é"), ["e"]);
});
