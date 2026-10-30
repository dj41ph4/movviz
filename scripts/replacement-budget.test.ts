import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import : jamais les vrais budgets de remplacement.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-replacement-budget-"));
process.env.MOVVIZ_CONFIG_DIR = config;

const { runReplacementAttempt, isReplacementError, hasReplacementRecord, ReplacementRefused } = await import("../src/lib/library/replacementRetry.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");
const { notifyRetryDelayMs } = await import("../engine/src/backends/AbstractBackend.mjs");

after(() => {
  flushPendingJsonWritesSync();
  fs.rmSync(config, { recursive: true, force: true });
});

/**
 * Ironheart S01E03 : « Remplacement refusé : nouveau fichier incomplet » renvoyé
 * en erreur 500 — le moteur réessayait toutes les 15 s, 860 fois en 4 heures.
 * Un refus doit entrer dans le budget (1 essai + 3 reprises espacées de 10 min).
 */
test("seuls les refus de remplacement entrent dans le budget, pas les vrais bugs", () => {
  assert.equal(isReplacementError(new Error("Remplacement refusé : nouveau fichier incomplet (/x.mkv)")), true);
  assert.equal(isReplacementError(new Error("Remplacement interrompu : ancien épisode conservé")), true);
  assert.equal(isReplacementError(new Error("Cannot read properties of undefined")), false);
  assert.equal(isReplacementError("Remplacement refusé"), false);
});

test("un refus est enregistré : 409 structuré, prochaine tentative dans 10 minutes", async () => {
  const hash = "a".repeat(40);
  assert.equal(hasReplacementRecord(hash), false);
  const refusal = new Error("Remplacement refusé : nouveau fichier incomplet (/data/série/Ironheart/Saison 1/Ironheart - S01E03.mkv)");
  await assert.rejects(
    runReplacementAttempt(hash, async () => { throw refusal; }, async () => {}),
    (err: unknown) => err instanceof ReplacementRefused && err.failure.reason === "incomplete" && err.failure.attempts === 1 && !err.failure.discarded && (err.failure.retryAt ?? 0) > Date.now() + 9 * 60_000
  );
  assert.equal(hasReplacementRecord(hash), true);
});

test("pendant l'attente, le travail n'est pas relancé à chaque rappel du moteur", async () => {
  const hash = "b".repeat(40);
  await assert.rejects(runReplacementAttempt(hash, async () => { throw new Error("Remplacement refusé : fichier incomplet"); }, async () => {}));
  let ran = 0;
  await assert.rejects(
    runReplacementAttempt(hash, async () => { ran++; return "ok"; }, async () => {}),
    (err: unknown) => err instanceof ReplacementRefused
  );
  assert.equal(ran, 0, "aucune nouvelle tentative avant retryAt");
});

test("le moteur espace ses rappels vers la bibliothèque : 15 s, puis ×2, plafonné à 15 min", () => {
  assert.equal(notifyRetryDelayMs(0), 15_000);
  assert.equal(notifyRetryDelayMs(1), 30_000);
  assert.equal(notifyRetryDelayMs(3), 120_000);
  assert.equal(notifyRetryDelayMs(6), 15 * 60_000);
  assert.equal(notifyRetryDelayMs(50), notifyRetryDelayMs(6));
  assert.ok(notifyRetryDelayMs(50) <= 15 * 60_000);
});
