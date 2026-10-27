import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueJob, getJobHolds, forceStartJob, getJobs } from "@/lib/jobs/queue";
import { markUserActivity, yieldToUser } from "@/lib/priority/userActivity";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (id: string) => getJobs().find((j) => j.id === id)?.status;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test("une tâche lourde planifiée retenue par l'activité d'un utilisateur indique laquelle, et se lance de force", async () => {
  markUserActivity({ id: "u1", username: "flayz" }, "/api/library/movies");
  const job = enqueueJob("maintenance", "Tâche lourde test", 1, async () => "fait", "test-heavy-1", { heavy: true, scheduled: true });
  await wait(50);
  assert.equal(statusOf(job.id), "queued", "retenue tant qu'un utilisateur est actif");
  const hold = getJobHolds()[job.id];
  assert.equal(hold?.code, "activity");
  assert.ok(hold.code === "activity" && hold.hold.code === "user_active" && hold.hold.user === "flayz" && hold.hold.path === "/api/library/movies");

  assert.deepEqual(forceStartJob(job.id), { ok: true });
  await wait(100);
  assert.equal(statusOf(job.id), "completed");
});

test("jamais deux tâches lourdes ensemble, même forcées : la raison est donnée", async () => {
  markUserActivity({ id: "u1", username: "flayz" });
  const gate = deferred();
  const first = enqueueJob("maintenance", "Lourde A", 1, () => gate.promise, "test-heavy-a", { heavy: true, scheduled: true });
  assert.deepEqual(forceStartJob(first.id), { ok: true });
  const second = enqueueJob("maintenance", "Lourde B", 1, async () => "b", "test-heavy-b", { heavy: true, scheduled: true });
  await wait(50);
  assert.equal(getJobHolds()[second.id]?.code, "heavy_running");
  assert.deepEqual(forceStartJob(second.id), { ok: false, error: "heavy_busy" });
  assert.equal(statusOf(second.id), "queued");
  gate.resolve();
  await wait(100);
  assert.equal(statusOf(first.id), "completed");
});

test("un job inconnu ou déjà lancé ne peut pas être forcé", () => {
  assert.deepEqual(forceStartJob("inexistant"), { ok: false, error: "not_queued" });
});

test("un job lancé de force ne cède plus la main à l'activité des utilisateurs", async () => {
  markUserActivity({ id: "u1", username: "flayz" });
  let waitedMs = -1;
  const job = enqueueJob("maintenance", "Lourde C", 1, async () => {
    const start = Date.now();
    await yieldToUser("test");
    waitedMs = Date.now() - start;
  }, "test-heavy-c", { heavy: true, scheduled: true });
  await wait(50);
  assert.deepEqual(forceStartJob(job.id), { ok: true });
  await wait(300);
  assert.equal(statusOf(job.id), "completed");
  assert.ok(waitedMs >= 0 && waitedMs < 500, `yieldToUser a attendu ${waitedMs} ms`);
});
