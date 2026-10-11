import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-plex-reconcile-"));
const { dropUnchangedFields } = await import("../src/lib/plex/librarySync.ts");

test("la réconciliation Plex ne compte pas comme modifié un film identique", () => {
  const movie = {
    status: "available",
    file: { path: "/film/a.mkv", size: 10, addedAt: 5, language: "fr" },
    versions: [{ id: "plex_1_0", path: "/film/a.mkv" }],
    plexMediaInfo: { container: "mkv", streams: [{ codec: "h264" }] },
  };
  const patch: Partial<typeof movie> = {
    file: { path: "/film/a.mkv", size: 10, addedAt: 5, language: "fr" },
    versions: [{ id: "plex_1_0", path: "/film/a.mkv" }],
    plexMediaInfo: { container: "mkv", streams: [{ codec: "h264" }] },
  };
  assert.deepEqual(dropUnchangedFields(movie, patch), {});
});

test("un vrai changement reste dans le patch, seul", () => {
  const movie = { status: "missing", file: { path: "/film/a.mkv", size: 10 }, plexMediaInfo: { container: "mkv" } };
  const patch = dropUnchangedFields(movie, {
    status: "available",
    file: { path: "/film/a.mkv", size: 11 },
    plexMediaInfo: { container: "mkv" },
  });
  assert.deepEqual(patch, { status: "available", file: { path: "/film/a.mkv", size: 11 } });
});
