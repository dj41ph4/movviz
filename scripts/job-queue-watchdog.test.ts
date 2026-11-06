import { test, mock } from "node:test";
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

test("une tâche longue qui avance n'est pas déclarée bloquée ; une tâche sans signe de vie l'est après 10 min", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    // Avance toutes les 4 min pendant 24 min : bien au-delà de 10 min, mais jamais 10 min sans signe de vie.
    const moving = enqueueJob("maintenance", "Longue qui avance", 6, async (setProgress) => {
      for (let i = 1; i <= 6; i++) { await sleep(4 * MIN); setProgress(i, 6); }
      return "fini";
    }, "test-watchdog-moving");
    // Ne dit rien pendant 30 min.
    const silent = enqueueJob("maintenance", "Silencieuse", 1, async () => { await sleep(30 * MIN); return "trop tard"; }, "test-watchdog-silent");
    await flush();
    for (let i = 0; i < 8; i++) await advance(4 * MIN);

    assert.equal(statusOf(moving.id), "completed", "elle avançait : jamais déclarée bloquée");
    assert.equal(statusOf(silent.id), "failed", "rien en 10 min : libérée");
    assert.match(getJobs().find((j) => j.id === silent.id)?.error ?? "", /sans avancement/);
  } finally {
    mock.timers.reset();
  }
});
