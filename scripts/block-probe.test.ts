import { test } from "node:test";
import assert from "node:assert/strict";
import { openBlockWindow, measureBlocking, getBlockLog } from "@/lib/blockProbe";

/** La sonde doit attribuer un gel réel à la fenêtre ouverte, et rien quand rien ne bloque. */

function blockFor(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* gel volontaire */ }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("un gel synchrone de 600 ms est mesuré et journalisé avec son étiquette", async () => {
  const w = openBlockWindow("tâche test-gel");
  await wait(150);
  blockFor(600);
  await wait(250);
  const { maxBlockMs } = w.end();
  assert.ok(maxBlockMs >= 450, `mesuré ${maxBlockMs} ms`);
  const entry = getBlockLog().find((e) => e.during.includes("tâche test-gel"));
  assert.ok(entry && entry.ms >= 450);
});

test("sans gel, la mesure reste faible", async () => {
  const { maxBlockMs, value } = await measureBlocking("tâche calme", async () => { await wait(400); return 42; });
  assert.equal(value, 42);
  assert.ok(maxBlockMs < 200, `mesuré ${maxBlockMs} ms`);
});

test("une erreur de la tâche est propagée et la fenêtre refermée", async () => {
  await assert.rejects(measureBlocking("tâche en échec", async () => { throw new Error("boom"); }), /boom/);
});
