import test from "node:test";
import assert from "node:assert/strict";
import { AbstractBackend } from "../engine/src/backends/AbstractBackend.mjs";

function run(files, targets, automatic = true) {
  const backend = Object.create(AbstractBackend.prototype);
  let selected;
  backend._clientSelectFiles = (_handle, indices) => { selected = [...indices]; };
  const meta = { rejectMissingSeriesPack: automatic, episodeTargets: targets };
  backend._selectEpisodeFiles({ name: "Show Complete", files: files.map(name => ({ name, path: name })) }, meta);
  return { meta, selected };
}
test("automatic integral without requested episodes is rejected only when coordinates are explicit", () => {
  const { meta, selected } = run(["Show.S01E01.mkv", "Show.S04E02.mkv"], [{ season: 5, episode: 1 }]);
  assert.equal(meta.missingSeriesPack, true);
  assert.equal(selected, undefined);
});
test("matching episode remains selected", () => {
  const { meta, selected } = run(["Show.S04E02.mkv", "Show.S05E01.mkv"], [{ season: 5, episode: 1 }]);
  assert.equal(meta.missingSeriesPack, undefined);
  assert.deepEqual(selected, [1]);
});
test("ambiguous filenames and manual packs are never automatically rejected", () => {
  assert.equal(run(["Show.S04E02.mkv", "Episode 01.mkv"], [{ season: 5, episode: 1 }]).meta.missingSeriesPack, undefined);
  assert.equal(run(["Show.S04E02.mkv"], [{ season: 5, episode: 1 }], false).meta.missingSeriesPack, undefined);
});
test("rejected pack leaves files intact and resumes searching after queue removal", async () => {
  const backend = Object.create(AbstractBackend.prototype);
  const calls = [];
  backend._clientSnapshot = () => ({ name: "Show.Complete" });
  backend.remove = async (hash, deleteData) => { calls.push({ hash, deleteData }); return true; };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; };
  try {
    const meta = { libraryRef: "series:sr_1", autoPackReleaseTitle: "Show.Complete" };
    await backend._rejectMissingSeriesPack("a".repeat(40), meta);
    assert.equal(calls[1].deleteData, false);
    assert.equal(calls[2].retry, true);
    assert.equal(calls[0].releaseTitle, "Show.Complete");
  } finally { globalThis.fetch = oldFetch; }
});
test("a rejection callback that is not yet acknowledged leaves the torrent alone", async () => {
  const backend = Object.create(AbstractBackend.prototype);
  let removed = false;
  backend._clientSnapshot = () => ({ name: "Show.Complete" });
  backend.remove = async () => { removed = true; };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 409 });
  try {
    await backend._rejectMissingSeriesPack("a".repeat(40), { libraryRef: "series:sr_1" });
    assert.equal(removed, false);
  } finally { globalThis.fetch = oldFetch; }
});
