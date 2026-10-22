import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Données isolées : les journaux et l'état du planificateur ne touchent pas
// le vrai dossier de données.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-heavy-"));
process.env.MOVVIZ_DATA_DIR = dataDir;
process.env.MOVVIZ_CONFIG_DIR = dataDir;

const { enqueueJob, getJobs, requestCancelJob } = await import("@/lib/jobs/queue");
const { yieldToEventLoop } = await import("@/lib/jobs/cancelScope");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await sleep(10);
  }
}

test("jamais deux tâches lourdes en même temps, les légères continuent", async () => {
  let heavyRunning = 0;
  let maxHeavy = 0;
  let lightDone = false;
  const heavy = async () => {
    heavyRunning++;
    maxHeavy = Math.max(maxHeavy, heavyRunning);
    await sleep(60);
    heavyRunning--;
  };
  const a = enqueueJob("maintenance", "lourde A", 1, heavy, "test-heavy-a", { heavy: true, scheduled: true });
  const b = enqueueJob("maintenance", "lourde B", 1, heavy, "test-heavy-b", { heavy: true, scheduled: true });
  enqueueJob("maintenance", "légère", 1, async () => { lightDone = true; }, "test-light", { scheduled: true });
  await waitFor(() => lightDone);
  // La légère a fini alors que la première lourde tourne encore.
  assert.equal(getJobs().find((j) => j.id === b.id)?.status, "queued");
  await waitFor(() => getJobs().filter((j) => j.id === a.id || j.id === b.id).every((j) => j.status === "completed"));
  assert.equal(maxHeavy, 1);
});

test("une recherche manuelle lourde met en pause la tâche lourde automatique", async () => {
  const order: string[] = [];
  const auto = enqueueJob("maintenance", "auto lourde", 1, async () => {
    order.push("auto:start");
    for (let i = 0; i < 500; i++) {
      await sleep(5);
      await yieldToEventLoop(); // point d'arrêt
    }
    order.push("auto:end");
  }, "test-auto", { heavy: true, scheduled: true });
  await waitFor(() => order.includes("auto:start"));
  const manual = enqueueJob("qualityUpgrade", "manuelle lourde", 1, async () => {
    order.push("manual");
  }, "test-manual", { heavy: true });
  await waitFor(() => getJobs().find((j) => j.id === manual.id)?.status === "completed");
  assert.equal(getJobs().find((j) => j.id === auto.id)?.status, "cancelled");
  assert.deepEqual(order, ["auto:start", "manual"]);
});

test("Arrêter : une tâche en cours s'arrête à son prochain point d'arrêt", async () => {
  let iterations = 0;
  const job = enqueueJob("maintenance", "longue", 1, async () => {
    for (let i = 0; i < 1000; i++) {
      iterations++;
      await sleep(2);
      await yieldToEventLoop();
    }
  }, "test-stop", { heavy: true, scheduled: true });
  await waitFor(() => iterations > 3);
  assert.equal(requestCancelJob(job.id), true);
  await waitFor(() => getJobs().find((j) => j.id === job.id)?.status === "cancelled");
  assert.ok(iterations < 1000);
});

test("un ajout démarre malgré les trois places occupées et les acquisitions restent séquentielles", async () => {
  let releaseBackground!: () => void;
  let releaseAcquisition!: () => void;
  const backgroundGate = new Promise<void>((resolve) => { releaseBackground = resolve; });
  const acquisitionGate = new Promise<void>((resolve) => { releaseAcquisition = resolve; });
  const background = [0, 1, 2].map((n) => enqueueJob("maintenance", `fond ${n}`, 1,
    async () => { await backgroundGate; }, `reserved-background-${n}`, { scheduled: true, heavy: n === 0 }));
  try {
    await waitFor(() => background.every((job) => job.status === "running"));
    const first = enqueueJob("qualityUpgrade", "ajout film", 1, async () => { await acquisitionGate; }, "reserved-first", { immediate: true });
    const second = enqueueJob("qualityUpgrade", "ajout série", 1, async () => {}, "reserved-second", { immediate: true });
    assert.equal(first.status, "running", "starts immediately without awaiting the background task or engine check");
    assert.equal(second.status, "queued", "only one acquisition uses the reserved lane");
    assert.ok(background.every((job) => job.status === "running"), "background work is not cancelled");
    releaseAcquisition();
    await waitFor(() => first.status === "completed" && second.status === "completed");
  } finally {
    releaseAcquisition();
    releaseBackground();
    await waitFor(() => background.every((job) => job.status === "completed"));
  }
});

test("les intervalles personnalisés sont remis par défaut une seule fois", async () => {
  fs.writeFileSync(
    path.join(dataDir, "scheduler.json"),
    JSON.stringify({ runs: {}, configs: { "disk-scan": { intervalMs: 120000 } } })
  );
  const { getTaskConfig, updateTaskConfig } = await import("@/lib/scheduler/state");
  assert.equal(getTaskConfig("disk-scan").intervalMs, null);
  updateTaskConfig("disk-scan", { intervalMs: 180000 });
  // Le réglage fait après la remise à zéro est conservé.
  assert.equal(getTaskConfig("disk-scan").intervalMs, 180000);
});
