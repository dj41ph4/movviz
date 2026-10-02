import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("old completed bootstraps replay once and V3 resumes without a lifetime cap", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-bootstrap-replay-"));
  process.env.MOVVIZ_CONFIG_DIR = directory;
  fs.writeFileSync(path.join(directory, "plex-history-bootstrap.json"), JSON.stringify({
    "alice::machine": { version: 2, status: "COMPLETED", currentStart: 500 },
  }));
  const store = await import("@/lib/plex/plexHistoryBootstrap");
  assert.equal(store.getBootstrapState("alice", "machine")?.status, "PENDING");
  assert.equal(store.getBootstrapState("alice", "machine")?.currentStart, 0);
  store.startBootstrap("alice", "machine", 12_345, 1_700_000_000_000);
  store.updateBootstrapProgress("alice", "machine", 12_345, 12_300, 45, 12_345, 0, 12_345);
  store.completeBootstrap("alice", "machine");
  assert.equal(store.ensureBootstrapPending("alice", "machine").status, "COMPLETED");
  assert.equal(store.getBootstrapState("alice", "machine")?.processedEvents, 12_345);
  assert.equal(store.getBootstrapState("alice", "machine")?.version, 3);
});
