import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createProbeLimiter } from "@/lib/playback/engine/probeLimiter";

/**
 * Une réconciliation Plex complète lançait ~2 000 ffprobe d'un coup : tous
 * expiraient, rien n'entrait dans le cache, et la vague recommençait le
 * lendemain. Ces tests verrouillent la limite, la priorité, la déduplication
 * et la mémoire des échecs.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("jamais plus de N tâches en même temps", async () => {
  const limiter = createProbeLimiter(2);
  let running = 0, peak = 0;
  const tasks = Array.from({ length: 20 }, () =>
    limiter.run("background", async () => {
      running++; peak = Math.max(peak, running);
      await wait(5);
      running--;
    }).promise
  );
  await Promise.all(tasks);
  assert.equal(peak, 2);
});

test("la lecture passe devant l'arrière-plan, y compris une tâche promue", async () => {
  const limiter = createProbeLimiter(1);
  const order: string[] = [];
  const job = (name: string) => async () => { order.push(name); await wait(2); };
  const first = limiter.run("background", job("bg1"));
  limiter.run("background", job("bg2"));
  const bg3 = limiter.run("background", job("bg3"));
  limiter.run("foreground", job("lecture"));
  bg3.promote();
  await first.promise;
  await wait(30);
  assert.deepEqual(order, ["bg1", "lecture", "bg3", "bg2"]);
});

test("une erreur libère la place", async () => {
  const limiter = createProbeLimiter(1);
  await assert.rejects(limiter.run("background", async () => { throw new Error("boom"); }).promise);
  assert.equal(await limiter.run("background", async () => 42).promise, 42);
  assert.equal(limiter.stats().running, 0);
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

test("cache ffprobe : déduplication, limite globale, échecs mémorisés", { skip: !hasFfmpeg && "ffmpeg absent" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-probe-"));
  process.env.MOVVIZ_CONFIG_DIR = dir;
  const { getOrProbeMediaDescriptor, hasCachedMediaDescriptor } = await import("@/lib/playback/engine/mediaProbeCache");
  const { probeLimiter } = await import("@/lib/playback/engine/probeLimiter");

  const files: string[] = [];
  for (let i = 0; i < 6; i++) {
    const f = path.join(dir, `f${i}.mkv`);
    spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=64x64:duration=1", "-c:v", "mpeg4", f]);
    files.push(f);
  }
  const bad = path.join(dir, "casse.mkv");
  fs.writeFileSync(bad, "pas une vidéo");

  // 10 demandes du même fichier = un seul ffprobe.
  const same = Array.from({ length: 10 }, () => getOrProbeMediaDescriptor("mv_same", files[0], false, { priority: "background" }));
  await wait(0);
  const s1 = probeLimiter.stats();
  assert.equal(s1.running + s1.queuedBackground + s1.queuedForeground, 1);
  const results = await Promise.all(same);
  assert.ok(results.every((r) => r && r === results[0]));
  assert.ok(hasCachedMediaDescriptor("mv_same"));

  // Une vague de fichiers distincts reste plafonnée à 2 processus.
  const wave = files.map((f, i) => getOrProbeMediaDescriptor(`mv_${i}`, f, false, { priority: "background" }));
  await wait(0);
  assert.ok(probeLimiter.stats().running <= 2);
  assert.ok((await Promise.all(wave)).every((r) => r?.video));

  // Échec : la raison est visible, et l'arrière-plan ne réessaie pas le même fichier.
  await assert.rejects(getOrProbeMediaDescriptor("mv_bad", bad), (err: Error) => /code \d+: \S/.test(err.message));
  assert.equal(await getOrProbeMediaDescriptor("mv_bad", bad, false, { priority: "background" }), null);
  assert.equal(probeLimiter.stats().running, 0);
  // La lecture, elle, réessaie toujours.
  await assert.rejects(getOrProbeMediaDescriptor("mv_bad", bad));
});
