import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { enqueueJob, getJobs } from "@/lib/jobs/queue";

const MIN = 60_000;
const statusOf = (id: string) => getJobs().find((j) => j.id === id)?.status;
/** Laisse les promesses en attente se résoudre entre deux avances du temps simulé. */
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms: number) {
  mock.timers.tick(ms);
  await flush();
}

test("une tâche planifiée qui ne rend jamais la main ne retient pas indéfiniment les tâches lourdes derrière elle", async () => {
  // Le premier passage de la file interroge le moteur de téléchargement pour de vrai : on le laisse
  // répondre (ou échouer) avant de simuler l'horloge, la réponse reste ensuite en mémoire 5 s.
  enqueueJob("maintenance", "Amorce", 1, async () => "ok", "test-lane-prime");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  try {
    // Une tâche légère planifiée qui ne finit jamais (attente sans fin, comme le 2026-11-16).
    const hung = enqueueJob("maintenance", "Légère figée", 1, () => new Promise<string>(() => {}), "test-lane-hung", { scheduled: true });
    await advance(1_000);
    assert.equal(statusOf(hung.id), "running");
    let heavyRan = false;
    const heavy = enqueueJob("maintenance", "Lourde planifiée", 1, async () => { heavyRan = true; return "ok"; }, "test-lane-heavy", { scheduled: true, heavy: true });
    await flush();
    await advance(5 * MIN);
    assert.equal(statusOf(heavy.id), "queued", "tant que la légère tourne normalement, la lourde attend son tour");
    assert.equal(heavyRan, false);
    // Passé 10 min sans signe de vie, la légère est déclarée bloquée : la lourde passe.
    await advance(6 * MIN);
    assert.equal(statusOf(hung.id), "failed");
    // La file réinterroge le moteur (vrai appel réseau, hors horloge simulée) avant de relancer.
    const t0 = performance.now();
    while (performance.now() - t0 < 2500 && !heavyRan) { await new Promise((resolve) => setImmediate(resolve)); await flush(); }
    await advance(1 * MIN);
    assert.equal(heavyRan, true, "la file n'attend plus une tâche déclarée bloquée");
    assert.equal(statusOf(heavy.id), "completed");
  } finally {
    mock.timers.reset();
  }
});

// Le runner figé ne se termine jamais, par construction : on ne laisse pas le processus de test l'attendre.
after(() => { setImmediate(() => process.exit()); });
