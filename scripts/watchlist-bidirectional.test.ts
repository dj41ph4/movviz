import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import type { User } from "../src/lib/auth/types.ts";

const testRoot = path.join(process.cwd(), ".movviz-data", "tests");
mkdirSync(testRoot, { recursive: true });
const dir = mkdtempSync(path.join(testRoot, "watchlist-sync-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
const { addWatchlistItem, getWatchlistItem, removeWatchlistItem } = await import("../src/lib/watchlist/store.ts");
const { syncPlexUserMedia, syncPlexWatchlistMutation } = await import("../src/lib/plex/userMediaSync.ts");
const { getPlexWatchlistSnapshot } = await import("../src/lib/plex/client.ts");
const user = { id: "watchlist-sync-test", username: "test", plexToken: "personal-token" } as User;
const originalFetch = globalThis.fetch;
let remote: { type: string; tmdbId: number; addedAt: number; ratingKey: string }[] = [];
let failSnapshot = false;
const writes: string[] = [];
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/library/sections/watchlist/all")) {
    if (failSnapshot) return Response.json({}, { status: 503 });
    const headers = init?.headers as Record<string, string>;
    const start = Number(headers["x-plex-container-start"] ?? 0);
    const size = Number(headers["x-plex-container-size"] ?? 200);
    return Response.json({
    MediaContainer: { totalSize: remote.length, Metadata: remote.slice(start, start + size).map((item) => ({
      title: `Title ${item.tmdbId}`, type: item.type === "series" ? "show" : "movie",
      addedAt: Math.floor(item.addedAt / 1000), ratingKey: item.ratingKey,
      Guid: [{ id: `tmdb://${item.tmdbId}` }],
    })) },
    });
  }
  if (url.includes("/library/metadata/matches")) {
    const id = Number(new URL(url).searchParams.get("guid")?.split("//")[1]);
    return Response.json({ MediaContainer: { Metadata: [{ type: "movie", ratingKey: `plex-${id}`, Guid: [{ id: `tmdb://${id}` }] }] } });
  }
  if (url.includes("/actions/")) {
    writes.push(`${url.includes("addToWatchlist") ? "add" : "remove"}:${new URL(url).searchParams.get("ratingKey")}`);
    return Response.json({}, { status: 200 });
  }
  throw new Error(`Unexpected fetch ${url} ${init?.method}`);
};

test("Movviz additions resolve a Plex key and send the change without waiting for a poll", async () => {
  const at = Date.now() - 1000;
  const item = addWatchlistItem({ userId: user.id, type: "movie", tmdbId: 901, title: "Local", year: null, posterPath: null, rating: 0, addedAt: at, updatedAt: at });
  await syncPlexWatchlistMutation(user, item);
  assert.deepEqual(writes, ["add:plex-901"]);
  assert.equal(getWatchlistItem(user.id, "movie", 901)?.plexDiscoverRatingKey, "plex-901");
});

test("Plex addition and later removal use the observed time; a newer local edit wins", async () => {
  remote = [{ type: "movie", tmdbId: 902, addedAt: Date.now() - 60_000, ratingKey: "plex-902" }];
  await syncPlexUserMedia(user);
  assert.equal(getWatchlistItem(user.id, "movie", 902)?.present, true);
  remote = [];
  await syncPlexUserMedia(user);
  assert.equal(getWatchlistItem(user.id, "movie", 902)?.present, false);
  assert.equal(writes.includes("add:plex-902"), false);
});

test("Movviz removal sends Plex removal and remains removed on an older remote snapshot", async () => {
  const at = Date.now() - 30_000;
  remote = [{ type: "movie", tmdbId: 903, addedAt: at, ratingKey: "plex-903" }];
  await syncPlexUserMedia(user);
  removeWatchlistItem(user.id, "movie", 903);
  const item = getWatchlistItem(user.id, "movie", 903)!;
  await syncPlexWatchlistMutation(user, item);
  assert.ok(writes.includes("remove:plex-903"));
  await syncPlexUserMedia(user);
  assert.equal(getWatchlistItem(user.id, "movie", 903)?.present, false);
});

test("a failed Plex read cannot remove local items; a newer local edit wins over remote disappearance", async () => {
  remote = [{ type: "movie", tmdbId: 904, addedAt: Date.now() - 60_000, ratingKey: "plex-904" }];
  await syncPlexUserMedia(user);
  failSnapshot = true;
  remote = [];
  await syncPlexUserMedia(user);
  assert.equal(getWatchlistItem(user.id, "movie", 904)?.present, true);
  failSnapshot = false;
  const newer = Date.now() + 1000;
  addWatchlistItem({ userId: user.id, type: "movie", tmdbId: 904, title: "Local edit", year: null, posterPath: null, rating: 0, addedAt: newer, updatedAt: newer });
  await syncPlexUserMedia(user);
  assert.equal(getWatchlistItem(user.id, "movie", 904)?.present, true);
  assert.ok(writes.includes("add:plex-904"));
});

test("a multi-page Plex Watchlist is read completely before reconciliation", async () => {
  remote = Array.from({ length: 201 }, (_, index) => ({ type: "movie", tmdbId: 1000 + index, addedAt: Date.now() - 60_000, ratingKey: `plex-${1000 + index}` }));
  assert.equal((await getPlexWatchlistSnapshot(user.plexToken!))?.length, 201);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
