import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-safe-import-"));
process.env.MOVVIZ_CONFIG_DIR = path.join(root, "config");
fs.mkdirSync(process.env.MOVVIZ_CONFIG_DIR);
const { addMovie, getMovie, addSeries, getSeries } = await import("../src/lib/library/store.ts");
const { importMovieCandidate, importSeriesCandidate } = await import("../src/lib/library/indexImport.ts");
const id = (p: string) => Buffer.from(p).toString("base64url");
test("a movie import does not replace the existing library file or monitoring preference", async () => {
  const incoming = path.join(root, "incoming.mkv"); fs.writeFileSync(incoming, "new");
  const file = { path: path.join(root, "existing.mkv"), size: 3 };
  addMovie({ id: "m1", tmdbId: 101, title: "Movie", status: "available", monitored: false, file } as never);
  const result = await importMovieCandidate(id(incoming), 101, undefined, true);
  assert.deepEqual(result, { ok: false, error: "existing_file_conflict" });
  assert.deepEqual(getMovie("m1")?.file, file);
  assert.equal(getMovie("m1")?.monitored, false);
});
test("a series import leaves an already linked episode file and monitoring unchanged", async () => {
  const folder = path.join(root, "show"); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, "Show.S01E01.mkv"), "new");
  const file = { path: path.join(root, "old.mkv"), size: 3 };
  addSeries({ id: "s1", tmdbId: 102, title: "Show", monitored: false, seasons: [{ seasonNumber: 1, monitored: true, episodes: [{ seasonNumber: 1, episodeNumber: 1, status: "available", file }] }] } as never);
  assert.equal((await importSeriesCandidate(id(folder), 102, undefined, true)).ok, true);
  assert.deepEqual(getSeries("s1")?.seasons[0].episodes[0].file, file);
  assert.equal(getSeries("s1")?.monitored, false);
});
test("ambiguous duplicate episode files are not associated automatically", async () => {
  const folder = path.join(root, "ambiguous"); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, "Show.S01E01.first.mkv"), "one");
  fs.writeFileSync(path.join(folder, "Show.S01E01.second.mkv"), "two");
  const result = await importSeriesCandidate(id(folder), 103, undefined, true);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "no_episode_files");
});
