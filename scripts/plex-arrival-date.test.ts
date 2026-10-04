import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { PlexLibraryItem } from "../src/lib/plex/types.ts";
import { plexArrivalDate } from "../src/lib/plex/arrivalDate.ts";
import { recentEpisodesAcrossSeries } from "../src/lib/library/recentEpisodes.ts";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-plex-arrival-"));
const { toLibraryFileReconciled } = await import("../src/lib/plex/librarySync.ts");
const old = Date.UTC(2024, 0, 1);
const item: PlexLibraryItem = {
  ratingKey: "episode-1", tmdbId: 1, title: "Episode", year: 2024,
  viewCount: 1, addedAt: old / 1000, updatedAt: Date.now() / 1000,
  file: { path: "/media/Example/Season 1/S01E01.mkv", size: 1234, resolution: "1080p" },
  videoCodec: "H.264", audioCodec: "AAC", hdr: null, mediaDetail: null,
};

test("first Plex import uses its real arrival, not today's sync time", () => {
  assert.equal(toLibraryFileReconciled(item, null)?.addedAt, old);
  const now = Date.now();
  assert.equal(plexArrivalDate(old, now), old);
  for (const invalid of [0, -1, NaN, Infinity, now + 1000]) assert.equal(plexArrivalDate(invalid, now), now);
});

test("watched/unwatched and metadata refreshes keep the same episode arrival and ranking", () => {
  const file = toLibraryFileReconciled(item, null)!;
  const newer = { tmdbId: 2, addedAt: old + 60_000 };
  for (const viewCount of [0, 1, 0]) {
    const refreshed = toLibraryFileReconciled({ ...item, viewCount, title: "Updated metadata", updatedAt: Date.now() / 1000 }, file)!;
    assert.equal(refreshed.addedAt, old);
    assert.deepEqual(recentEpisodesAcrossSeries([{ tmdbId: 1, addedAt: refreshed.addedAt }, newer]).map(e => e.tmdbId), [2, 1]);
  }
});

test("a real replacement is a new arrival; a known local acquisition stays unchanged", () => {
  const file = toLibraryFileReconciled(item, null)!;
  const localArrival = old + 500_000;
  assert.equal(toLibraryFileReconciled(item, { ...file, addedAt: localArrival })?.addedAt, localArrival);
  const started = Date.now();
  const changed = toLibraryFileReconciled({ ...item, file: { ...item.file!, size: 5678 } }, file)!;
  assert.ok(changed.addedAt >= started);
  assert.equal(toLibraryFileReconciled(item, { ...file, addedAt: 0 })?.addedAt, old);
});
