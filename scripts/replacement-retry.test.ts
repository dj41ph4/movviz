import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("fichier utilisé : trois nouvelles tentatives à 10 minutes, suppression finale du nouveau", async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-retry-"));
  process.env.MOVVIZ_CONFIG_DIR = root;
  const { runReplacementAttempt, ReplacementRefused } = await import("@/lib/library/replacementRetry");
  const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
  let now = 1_000_000, attempts = 0, discarded = 0;
  t.mock.method(Date, "now", () => now);
  const fail = async () => { attempts++; throw Object.assign(new Error("file locked"), { code: "EBUSY" }); };
  const discard = async () => { discarded++; };
  try {
    for (let count = 1; count <= 4; count++) {
      await assert.rejects(runReplacementAttempt("hash", fail, discard), error => {
        assert.ok(error instanceof ReplacementRefused);
        assert.equal(error.failure.attempts, count);
        assert.equal(error.failure.reason, "fileInUse");
        assert.equal(error.failure.discarded, count === 4);
        return true;
      });
      await assert.rejects(runReplacementAttempt("hash", fail, discard));
      assert.equal(attempts, count, "un callback précoce ne consomme pas de tentative");
      now += 600_000;
    }
    assert.equal(discarded, 1);
    await assert.rejects(runReplacementAttempt("hash", fail, discard));
    assert.equal(attempts, 4);
    assert.equal(discarded, 1);
    let successCount = 0;
    await assert.rejects(runReplacementAttempt("recover", fail, discard));
    now += 600_000;
    assert.equal(await runReplacementAttempt("recover", async () => ++successCount, discard), 1);
    assert.equal(discarded, 1, "un succès ultérieur ne supprime pas le nouveau");
    flushPendingJsonWritesSync();
    const persisted = JSON.parse(await fsp.readFile(path.join(root, "replacement-retries.json"), "utf8"));
    assert.equal(persisted.hash.discarded, true);
    assert.equal(persisted.recover, undefined);
  } finally {
    flushPendingJsonWritesSync();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.match(path.basename(root), /^movviz-retry-/);
    await fsp.rm(root, { recursive: true, force: true });
  }
});
