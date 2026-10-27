import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForServerBack } from "@/lib/playback/waitForServerBack";

/** Horloge simulée : sleep avance le temps, aucun vrai délai. */
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

test("serveur déjà joignable : réponse immédiate, aucune attente", async () => {
  const c = clock();
  let calls = 0;
  const ok = await waitForServerBack(() => false, { ...c, check: async () => { calls++; return true; } });
  assert.equal(ok, true);
  assert.equal(calls, 1);
  assert.equal(c.now(), 0);
});

test("serveur qui redémarre : on attend son retour au lieu d'abandonner", async () => {
  const c = clock();
  let calls = 0;
  // 502 de nginx, puis erreurs réseau, puis le serveur revient après ~40 s.
  const check = async () => {
    calls++;
    if (c.now() < 20_000) return false; // 502
    if (c.now() < 40_000) throw new Error("ECONNREFUSED");
    return true;
  };
  const ok = await waitForServerBack(() => false, { ...c, check });
  assert.equal(ok, true);
  assert.ok(c.now() >= 40_000 && c.now() < 60_000, `attente ${c.now()} ms`);
  assert.ok(calls > 5);
});

test("serveur qui ne revient pas : abandon au délai maximum", async () => {
  const c = clock();
  const ok = await waitForServerBack(() => false, { ...c, maxWaitMs: 30_000, check: async () => false });
  assert.equal(ok, false);
  assert.ok(c.now() >= 30_000);
});

test("lecteur fermé pendant l'attente : on s'arrête sans insister", async () => {
  const c = clock();
  let stopped = false;
  let calls = 0;
  const ok = await waitForServerBack(() => stopped, {
    ...c,
    check: async () => { calls++; if (calls === 3) stopped = true; return false; },
  });
  assert.equal(ok, false);
  assert.equal(calls, 3);
});
