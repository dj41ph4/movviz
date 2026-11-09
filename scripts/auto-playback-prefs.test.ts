import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Données isolées : le magasin lit son dossier à l'import.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-autoplay-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
process.on("exit", () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignoré */ } });
const { loadUserPrefs, saveUserPrefs } = await import("@/lib/userPrefs/store");

test("passer l'intro, passer le générique et épisode suivant sont désactivés par défaut", () => {
  const prefs = loadUserPrefs("autoplay-default");
  assert.notEqual(prefs.autoSkipIntro, true);
  assert.notEqual(prefs.autoSkipCredits, true);
  assert.notEqual(prefs.autoNextEpisode, true);
});

test("chaque option se règle seule, sans toucher aux deux autres", () => {
  const id = "autoplay-independent";
  saveUserPrefs(id, { autoSkipIntro: true });
  let prefs = loadUserPrefs(id);
  assert.equal(prefs.autoSkipIntro, true);
  assert.notEqual(prefs.autoSkipCredits, true);
  assert.notEqual(prefs.autoNextEpisode, true);
  saveUserPrefs(id, { autoNextEpisode: true });
  prefs = loadUserPrefs(id);
  assert.equal(prefs.autoSkipIntro, true);
  assert.equal(prefs.autoNextEpisode, true);
  saveUserPrefs(id, { autoSkipIntro: false });
  assert.equal(loadUserPrefs(id).autoSkipIntro, false);
  assert.equal(loadUserPrefs(id).autoNextEpisode, true);
});

test("une valeur qui n'est pas un booléen est ignorée", () => {
  const id = "autoplay-invalid";
  saveUserPrefs(id, { autoSkipCredits: "oui", autoNextEpisode: 1 });
  const prefs = loadUserPrefs(id);
  assert.notEqual(prefs.autoSkipCredits, true);
  assert.notEqual(prefs.autoNextEpisode, true);
});

test("les options sont lues et écrites par le profil, pas par appareil", () => {
  // Les clients (web, Android, Samsung) passent tous par ces mêmes champs de compte.
  saveUserPrefs("autoplay-shared", { autoSkipCredits: true });
  assert.equal(loadUserPrefs("autoplay-shared").autoSkipCredits, true);
  assert.notEqual(loadUserPrefs("autoplay-other-user").autoSkipCredits, true);
});
