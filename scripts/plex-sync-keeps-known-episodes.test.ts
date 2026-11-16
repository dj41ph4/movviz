import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-plex-known-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

// A fake Plex holding episodes 501–503 (of whatever show); 900+ are gone.
let plexUp = true;
const asked: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (!plexUp) throw new Error("ECONNREFUSED");
  if (url.pathname === "/identity") return json({ MediaContainer: { machineIdentifier: "abc" } });
  const m = url.pathname.match(/^\/library\/metadata\/([\d,]+)$/);
  if (!m) return json({}, 404);
  asked.push(m[1]);
  const found = m[1].split(",").filter((k) => ["501", "502", "503"].includes(k));
  if (found.length === 0) return json({}, 404);
  return json({ MediaContainer: { Metadata: found.map((k) => ({ type: "episode", ratingKey: k, grandparentRatingKey: "77", grandparentTitle: "Autre fiche", parentIndex: 1, index: Number(k) - 500, title: "x" })) } });
}) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; });

const { plexItemsStillKnown } = await import("../src/lib/plex/librarySync.ts");
const cfg = { hostname: "plex.example.org", port: 32400, useSsl: true, adminToken: "t", clientId: "c", syncLibrary: true, watchlistSyncEnabled: false } as never;

// Naruto Shippuden, 2026-11-16: a Plex show listing 18 episodes was synced
// against the series and the 464 other episodes lost their file, although
// Plex still held every one of them under another show.
test("an episode a Plex show does not list is still known when Plex holds the item elsewhere", async () => {
  const known = await plexItemsStillKnown(cfg, "t", ["501", "502", "900", "503", "901", "501"]);
  assert.deepEqual([...known].sort(), ["501", "502", "503"], "kept: the three Plex still has; detached: the two it really lost");
});

test("no candidate, no call", async () => {
  const before = asked.length;
  assert.equal((await plexItemsStillKnown(cfg, "t", [])).size, 0);
  assert.equal(asked.length, before);
});

test("items Plex really lost are reported gone, however many, while Plex answers", async () => {
  const known = await plexItemsStillKnown(cfg, "t", ["900", "901", "902", "903", "904"]);
  assert.equal(known.size, 0);
});

test("Plex unreachable: every item counts as known — nothing is detached on an answer that never came", async () => {
  plexUp = false;
  try {
    const keys = ["900", "901", "902", "903", "904"];
    assert.deepEqual([...(await plexItemsStillKnown(cfg, "t", keys))].sort(), keys);
  } finally {
    plexUp = true;
  }
});
