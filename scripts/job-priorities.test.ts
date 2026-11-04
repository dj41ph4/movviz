import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

// Config isolée avant l'import : jamais les vraies données.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-job-priorities-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

const priorities = await import("../src/lib/jobs/priorities.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

after(() => {
  flushPendingJsonWritesSync();
  fs.rmSync(config, { recursive: true, force: true });
});

test("l'ordre des tâches est fixe : RSS avant la relance, mises à niveau qualité en dernier", () => {
  assert.equal(priorities.priorityOf("rssScan"), 58);
  assert.equal(priorities.priorityOf("qualityUpgrade"), 11);
  assert.ok(priorities.priorityOf("rssScan") > priorities.priorityOf("metadataRefresh"));
  assert.ok(priorities.priorityOf("reconcile") > priorities.priorityOf("maintenance"));
});

test("le ralentissement pendant un téléchargement est activé par défaut", () => {
  assert.equal(priorities.isBackgroundSlowedDuringDownload(), true);
});

test("une installation qui avait baissé l'ancien curseur « Téléchargements » garde son choix", () => {
  fs.writeFileSync(path.join(config, "job-priorities.json"), JSON.stringify({ download: 30 }));
  // Le cache de lecture JSON suit le fichier : relit après écriture directe.
  assert.equal(priorities.isBackgroundSlowedDuringDownload(), false);
});

test("le nouvel interrupteur l'emporte sur l'ancien réglage", () => {
  priorities.setBackgroundSlowedDuringDownload(true);
  assert.equal(priorities.isBackgroundSlowedDuringDownload(), true);
  priorities.setBackgroundSlowedDuringDownload(false);
  assert.equal(priorities.isBackgroundSlowedDuringDownload(), false);
});
