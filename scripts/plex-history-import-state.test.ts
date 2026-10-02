import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("JSON-only import verifies actual movie/episode views and their user/date", async () => {
  process.env.MOVVIZ_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-import-state-"));
  process.env.MOVVIZ_CONTEXT_ENGINE_DISABLED = "true";
  const { setWatchedMovies, setWatchedEpisodes } = await import("@/lib/plex/watchStore");
  const { getImportWatchState } = await import("@/lib/plex/historyMerge");
  const movie = { type: "movie", tmdbId: 42 } as const;
  const episode = { type: "episode", tmdbShowId: 100, seasonNumber: 2, episodeNumber: 3 } as const;
  const at = 1_700_000_000_000;
  assert.equal(setWatchedMovies("cassy", [42], true, "movie", at, "plex_history"), true);
  assert.equal(setWatchedEpisodes("cassy", [{ tmdbId: 100, season: 2, episode: 3, watchedAt: at }], true, "series", "plex_history"), true);
  assert.deepEqual(getImportWatchState("cassy", movie, false), { state: "watched", updatedAt: at });
  assert.deepEqual(getImportWatchState("cassy", episode, false), { state: "watched", updatedAt: at });
  assert.equal(getImportWatchState("other-user", movie, false).state, "unknown");
  assert.equal(getImportWatchState("other-user", episode, false).state, "unknown");
  assert.equal(getImportWatchState("cassy", movie, true).state, "unknown");
});
