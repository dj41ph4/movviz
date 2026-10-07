import { test } from "node:test";
import assert from "node:assert/strict";
import { torrentActivityStatus } from "@/lib/activity/v2/torrentStatus";

test("seed confirmé prioritaire sur un ancien statut bloqué", () => {
  for (const state of ["completed", "seeding", "blocked", "stalled"]) assert.equal(torrentActivityStatus({ state, seeding: true }), "seeding");
  assert.equal(torrentActivityStatus({ state: "blocked", seeding: false }), "stalled");
  assert.equal(torrentActivityStatus({ state: "metadata" }), "downloading");
  assert.equal(torrentActivityStatus({ state: "paused", seeding: true }), "paused");
  assert.equal(torrentActivityStatus({ state: "verifying", seeding: true }), "verifying");
});
