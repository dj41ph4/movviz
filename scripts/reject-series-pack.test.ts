import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-series-reject-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
const { POST } = await import("../src/app/api/library/reject-series-pack/route.ts");
const { addSeries, getSeries } = await import("../src/lib/library/store.ts");
const { getEngineToken } = await import("../src/lib/engine/token.ts");
const { isRecentlyFailedSeriesPack } = await import("../src/lib/library/failedReleases.ts");
const hash = "a".repeat(40);
const other = "b".repeat(40);
const req = (token = getEngineToken()) => new NextRequest("http://localhost/api/library/reject-series-pack", {
  method: "POST", headers: { "content-type": "application/json", "x-movviz-token": token },
  body: JSON.stringify({ libraryRef: "series:sr_test", infoHash: hash, releaseTitle: "Show.Complete" }),
});

test("rejects only claimed episodes, retains available files, and can be replayed", async () => {
  const file = { path: "/media/existing.mkv", size: 1 };
  addSeries({ id: "sr_test", tmdbId: 1234, title: "Show", seasons: [{ seasonNumber: 1, episodes: [
    { seasonNumber: 1, episodeNumber: 1, status: "downloading", activeInfoHash: hash, file: null },
    { seasonNumber: 1, episodeNumber: 2, status: "downloading", activeInfoHash: other, file: null },
    { seasonNumber: 1, episodeNumber: 3, status: "available", activeInfoHash: null, file },
  ] }] } as never);
  assert.equal((await POST(req("wrong"))).status, 401);
  assert.equal((await POST(req())).status, 200);
  const episodes = getSeries("sr_test")!.seasons[0].episodes;
  assert.equal(episodes[0].status, "missing");
  assert.equal(episodes[0].activeInfoHash, null);
  assert.equal(episodes[1].activeInfoHash, other);
  assert.deepEqual(episodes[2].file, file);
  assert.equal((await POST(req())).status, 200);
  assert.equal(isRecentlyFailedSeriesPack("sr_test", { infoHash: null, title: "Show.Complete" }), true);
  assert.equal(isRecentlyFailedSeriesPack("another", { infoHash: null, title: "Show.Complete" }), false);
});
