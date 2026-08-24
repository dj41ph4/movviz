import { test } from "node:test";
import assert from "node:assert/strict";
import { correctedLanguage } from "@/lib/playback/localStreamInfo";

test("corrige un libellé Plex faux vers l'autonyme ffprobe (cas réel : '8 Mile' — Plex dit Français, le fichier dit eng)", () => {
  assert.equal(correctedLanguage("Français", "eng"), "English");
});

test("laisse un libellé Plex déjà correct inchangé (même langue, casse différente)", () => {
  assert.equal(correctedLanguage("english", "eng"), "english");
  assert.equal(correctedLanguage("Français", "fre"), "Français");
});

test("aucun tag ffprobe pour cette position => garde le libellé Plex tel quel", () => {
  assert.equal(correctedLanguage("Français", undefined), "Français");
});

test("code ffprobe inconnu/non mappé => garde le libellé Plex tel quel plutôt que d'inventer", () => {
  assert.equal(correctedLanguage("Français", "xyz"), "Français");
});
