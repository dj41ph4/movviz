import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { User } from "../src/lib/auth/types.ts";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-episode-resume-"));
process.env.MOVVIZ_CONFIG_DIR = tempDir;
process.env.MOVVIZ_TMDB_API_KEY = "";
const episode = (number: number) => ({ seasonNumber: 1, episodeNumber: number, title: `Episode ${number}`, file: { path: `/media/slime-${number}.mkv` }, plexRatingKey: `slime-${number}`, status: "available" });
fs.writeFileSync(path.join(tempDir, "library-series.json"), JSON.stringify([{
  id: "sr_slime", tmdbId: 82684, title: "Moi, quand je me réincarne en Slime", posterPath: null,
  year: 2018, rating: 8, seasons: [
    { seasonNumber: 2, episodes: [{ ...episode(1), seasonNumber: 2, plexRatingKey: "slime-s2e1" }] },
    { seasonNumber: 1, episodes: [episode(2), episode(1)] },
  ],
}]));
const { openPlaybackSession, applyHeartbeat, applySeek, stopPlayback } = await import("../src/lib/playback/progressStore.ts");
const { getCanonicalWatchStatus } = await import("../src/lib/userContext/watchBridge.ts");
const { getWatchStatus, setWatchedEpisodes } = await import("../src/lib/plex/watchStore.ts");
const { listOnDeckEntries } = await import("../src/lib/plex/onDeckService.ts");

test("Slime S01E01: resume below 80%, watched at 80%, then S01E02, then S02E01", async () => {
  const user = { id: "episode-user" } as User;
  // Legacy Android did not send season/episode. Resolve them from the key.
  const { session, progress } = openPlaybackSession(user.id, { ratingKey: "slime-1", mediaType: "episode", durationMs: 1_440_000, tmdbId: 82684 });
  assert.equal(progress.seasonNumber, 1);
  assert.equal(progress.episodeNumber, 1);
  applyHeartbeat(session.id, { sequence: 1, positionMs: 30_000, isPlaying: true, nowMs: session.startedAt + 30_000 });
  applyHeartbeat(session.id, { sequence: 2, positionMs: 60_000, isPlaying: true, nowMs: session.startedAt + 60_000 });
  applySeek(session.id, 1_140_000);
  applyHeartbeat(session.id, { sequence: 3, positionMs: 1_140_000, isPlaying: false });
  let items = await listOnDeckEntries(user);
  assert.equal(items[0]?.episodeNumber, 1);
  assert.equal(items[0]?.offsetMs, 1_140_000);
  const stopped = stopPlayback(session.id, 1_152_000);
  assert.equal(stopped.watched, true);
  assert.equal(stopped.resumeOffsetMs, null);
  assert.ok((getCanonicalWatchStatus(user.id) ?? getWatchStatus(user.id))?.episodes.some((e) => e.tmdbId === 82684 && e.season === 1 && e.episode === 1));
  items = await listOnDeckEntries(user);
  assert.equal(items.length, 1);
  assert.equal(items[0].seasonNumber, 1);
  assert.equal(items[0].episodeNumber, 2);
  assert.equal(items[0].offsetMs, 0);
  setWatchedEpisodes(user.id, [{ tmdbId: 82684, season: 1, episode: 2 }], true);
  items = await listOnDeckEntries(user);
  assert.equal(items[0].seasonNumber, 2);
  assert.equal(items[0].episodeNumber, 1);
  assert.deepEqual(await listOnDeckEntries({ id: "other-user" } as User), []);
  setWatchedEpisodes(user.id, [{ tmdbId: 82684, season: 2, episode: 1 }], true);
  assert.deepEqual(await listOnDeckEntries(user), []);
});

test("local-only episode keys also recover their season and episode", () => {
  const { progress } = openPlaybackSession("local-user", { ratingKey: "sr_slime:s1e2", mediaType: "episode", durationMs: 1_440_000 });
  assert.equal(progress.tmdbId, 82684);
  assert.equal(progress.seasonNumber, 1);
  assert.equal(progress.episodeNumber, 2);
});

test.after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Keep the disposable data directory: SQLite may retain an open handle on Windows.
});
