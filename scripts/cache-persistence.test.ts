import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getCache } from "@/lib/cache/registry";

/**
 * Cache persisté (TMDb en prod : ~360 Mo). Écrit une entrée par ligne, relu
 * en flux au démarrage sans figer le serveur, migré depuis l'ancien fichier
 * JSON d'un seul bloc. Chaque test utilise un nom de cache et un dossier
 * uniques : le registre est global au processus.
 */

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "movviz-cache-"));
}

const big = (i: number) => ({ id: i, overview: "x".repeat(20_000), cast: [{ name: "Acteur é " + i }] });

async function waitWritten(c: unknown) {
  const cache = c as { saveToDisk: () => void; writeInFlight: boolean };
  cache.saveToDisk();
  while (cache.writeInFlight) await new Promise((r) => setTimeout(r, 5));
}

test("migration : l'ancien fichier JSON est relu, puis réécrit ligne par ligne et supprimé", async () => {
  const dir = tmpDir();
  const legacy = path.join(dir, "c.json");
  fs.writeFileSync(legacy, JSON.stringify({ a: { value: { n: 1 }, expiresAt: Date.now() + 1e6 }, b: { value: "é", expiresAt: 0 } }));
  const c = getCache(`mig-${Date.now()}`, 60_000, legacy);
  await c.whenLoaded();
  assert.deepEqual(c.getStale("a"), { value: { n: 1 }, fresh: true });
  assert.deepEqual(c.getStale("b"), { value: "é", fresh: false });
  await waitWritten(c);
  assert.equal(fs.existsSync(legacy), false);
  const lines = fs.readFileSync(path.join(dir, "c.ndjson"), "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0])[0], "a");
});

test("aller-retour : ce qui est écrit est relu à l'identique au démarrage suivant", async () => {
  const dir = tmpDir();
  const file = path.join(dir, "rt.json");
  const name = `rt-${Date.now()}`;
  const c = getCache(name, 60_000, file);
  c.set("k1", { deep: { list: [1, 2, 3] }, s: "ligne\nretour" });
  c.set("k2", 42);
  await waitWritten(c);
  const again = getCache(`${name}-reload`, 60_000, file);
  await again.whenLoaded();
  assert.deepEqual(again.getStale("k1")?.value, { deep: { list: [1, 2, 3] }, s: "ligne\nretour" });
  assert.equal(again.getStale("k2")?.value, 42);
});

test("gros cache : chargé en flux sans figer la boucle, entrées récentes prioritaires, pas d'écriture partielle", async () => {
  const dir = tmpDir();
  const file = path.join(dir, "big.json");
  const lines: string[] = [];
  for (let i = 0; i < 800; i++) lines.push(JSON.stringify([`k${i}`, { value: big(i), expiresAt: Date.now() + 1e6 }]));
  fs.writeFileSync(path.join(dir, "big.ndjson"), lines.join("\n") + "\n");
  assert.ok(fs.statSync(path.join(dir, "big.ndjson")).size > 8 * 1024 * 1024);

  let last = performance.now();
  let maxGap = 0;
  const iv = setInterval(() => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; }, 2);
  const c = getCache(`big-${Date.now()}`, 60_000, file);
  // Pendant le chargement : une valeur fraîche posée par une requête gagne,
  // et une sauvegarde est différée (sinon elle écraserait le fichier complet).
  c.set("k5", "frais");
  (c as unknown as { saveToDisk: () => void }).saveToDisk();
  await c.whenLoaded();
  clearInterval(iv);

  assert.equal(c.getStale("k5")?.value, "frais");
  assert.equal((c.getStale("k799")?.value as { id: number }).id, 799);
  assert.ok(maxGap < 150, `boucle figée ${Math.round(maxGap)} ms pendant le chargement`);
  await new Promise((r) => setTimeout(r, 50));
  while ((c as unknown as { writeInFlight: boolean }).writeInFlight) await new Promise((r) => setTimeout(r, 5));
  const written = fs.readFileSync(path.join(dir, "big.ndjson"), "utf8").trim().split("\n");
  assert.equal(written.length, 800);
});

test("clear() pendant le chargement : rien ne ressuscite", async () => {
  const dir = tmpDir();
  const file = path.join(dir, "clr.json");
  const lines: string[] = [];
  for (let i = 0; i < 600; i++) lines.push(JSON.stringify([`k${i}`, { value: big(i), expiresAt: Date.now() + 1e6 }]));
  fs.writeFileSync(path.join(dir, "clr.ndjson"), lines.join("\n") + "\n");
  const c = getCache(`clr-${Date.now()}`, 60_000, file);
  c.clear();
  await c.whenLoaded();
  assert.equal(c.stats().keys, 0);
});

test("lignes corrompues : ignorées, le reste est gardé", async () => {
  const dir = tmpDir();
  const file = path.join(dir, "bad.json");
  fs.writeFileSync(path.join(dir, "bad.ndjson"), `${JSON.stringify(["ok", { value: 1, expiresAt: 0 }])}\n{tronqué\n`);
  const c = getCache(`bad-${Date.now()}`, 60_000, file);
  await c.whenLoaded();
  assert.equal(c.getStale("ok")?.value, 1);
  assert.equal(c.stats().keys, 1);
});

test("attente plafonnée : un chargement lent ne retient jamais la requête au-delà du plafond", async () => {
  const dir = tmpDir();
  const file = path.join(dir, "slow.json");
  const lines: string[] = [];
  for (let i = 0; i < 700; i++) lines.push(JSON.stringify([`k${i}`, { value: big(i), expiresAt: Date.now() + 1e6 }]));
  fs.writeFileSync(path.join(dir, "slow.ndjson"), lines.join("\n") + "\n");
  const c = getCache(`slow-${Date.now()}`, 60_000, file);
  const t = performance.now();
  await c.whenLoaded(1);
  assert.ok(performance.now() - t < 100, "l'attente plafonnée doit rendre la main tout de suite");
  await c.whenLoaded();
  assert.equal(c.stats().keys, 700);
});
