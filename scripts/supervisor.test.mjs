import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RecoveryPolicy, supervise } from "../packaging/docker/supervisor.mjs";

test("seuil durable, grâce au démarrage, retour à la normale et limite des relances", () => {
  const policy = new RecoveryPolicy();
  policy.started(0);
  assert.equal(policy.check(false, 599999), false);
  assert.equal(policy.check(false, 600000), false);
  assert.equal(policy.check(false, 899999), false);
  assert.equal(policy.check(true, 900000), false);
  assert.equal(policy.check(false, 900001), false);
  assert.equal(policy.check(false, 1200001), true);
  policy.restarted(1200001);
  policy.started(1200001);
  assert.equal(policy.check(false, 1800001), false);
  assert.equal(policy.check(false, 2100001), true);
  policy.restarted(2100001);
  policy.restarted(3000001);
  policy.started(3000001);
  assert.equal(policy.check(false, 3600001), false);
  assert.equal(policy.check(false, 3900001), false);
});

test("le superviseur remplace réellement le processus malade et conserve le nouveau processus sain", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-supervisor-"));
  const marker = path.join(dir, "starts.jsonl");
  const script = path.join(dir, "server.mjs");
  fs.writeFileSync(script, `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(marker)}, process.pid+String.fromCharCode(10)); setInterval(()=>{},1000);`);
  const starts = () => fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim().split("\n") : [];
  const server = http.createServer((_req, res) => { res.statusCode = starts().length >= 2 ? 200 : 503; res.end(); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const stop = supervise({ args: [script], url: `http://127.0.0.1:${server.address().port}/api/healthz`,
    intervalMs: 30, timeoutMs: 200, stopMs: 300,
    policy: new RecoveryPolicy({ graceMs: 100, failureMs: 100, cooldownMs: 100 }) });
  try {
    const until = Date.now() + 5000;
    while (starts().length < 2 && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(starts().length, 2);
    assert.notEqual(starts()[0], starts()[1]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(starts().length, 2);
  } finally {
    await stop();
    await new Promise((resolve) => server.close(resolve));
  }
});
