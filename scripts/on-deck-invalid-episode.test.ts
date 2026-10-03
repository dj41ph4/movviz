import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { User } from "../src/lib/auth/types.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-on-deck-validity-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
process.env.MOVVIZ_TMDB_API_KEY = "";
fs.writeFileSync(path.join(dir, "library-series.json"), JSON.stringify([{
  id: "sr_56", tmdbId: 241372, title: "56 jours", posterPath: null, year: 2026, rating: 7,
  plexRatingKey: "show-56", seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 8 }, (_, i) => ({
    seasonNumber: 1, episodeNumber: i + 1, title: `Episode ${i + 1}`, status: "available",
    file: { path: `/media/56-${i + 1}.mkv` }, plexRatingKey: `56-${i + 1}`,
  })) }],
}]));

const { setWatchedEpisodes, getWatchStatus } = await import("../src/lib/plex/watchStore.ts");
const { savePlexConfig } = await import("../src/lib/plex/store.ts");
const { listOnDeckEntries } = await import("../src/lib/plex/onDeckService.ts");
const { updateSeries } = await import("../src/lib/library/store.ts");
const { openPlaybackSession, applySeek } = await import("../src/lib/playback/progressStore.ts");
const { batchTmdbIds } = await import("../src/lib/plex/client.ts");

test("Plex phantom successor disappears; imported history and other profiles are preserved", async () => {
  const user = { id: "misscassylove", username: "misscassylove", role: "user", plexServerToken: "scoped-fixture" } as User;
  setWatchedEpisodes(user.id, Array.from({ length: 8 }, (_, i) => ({ tmdbId: 241372, season: 1, episode: i + 1 })), true);
  const before = JSON.stringify(getWatchStatus(user.id));
  const config = { hostname: "plex.example", port: 32400, useSsl: false, adminToken: "owner-fixture", clientId: "fixture", machineIdentifier: "fixture", syncLibrary: false, watchlistSyncEnabled: false, markerSyncEnabled: false };
  savePlexConfig(config);
  const originalFetch = globalThis.fetch;
  let candidate = 9;
  let offset = 0;
  const requestedTokens: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const token = new Headers(init?.headers).get("x-plex-token") ?? "";
    requestedTokens.push(token);
    if (url.includes("/library/onDeck")) {
      return Response.json({ MediaContainer: { Metadata: token === user.plexServerToken ? [{
        ratingKey: `56-${candidate}`, type: "episode", grandparentRatingKey: "show-56",
        parentIndex: 1, index: candidate, viewOffset: offset, duration: 2_400_000,
      }] : [] } });
    }
    if (url.includes("/library/metadata/")) {
      return Response.json({ MediaContainer: { Metadata: [
        { ratingKey: "show-56", type: "show", Guid: [{ id: "tmdb://241372" }] },
        { ratingKey: `56-${candidate}`, type: "episode", parentIndex: 1, index: candidate,
          Media: [{ Part: [{ key: `/library/parts/${candidate}/file` }] }] },
      ] } });
    }
    throw new Error(`Unexpected fixture request: ${url}`);
  }) as typeof fetch;
  try {
    assert.deepEqual(await listOnDeckEntries(user), []);
    assert.equal(JSON.stringify(getWatchStatus(user.id)), before);
    assert.deepEqual(await listOnDeckEntries({ id: "unlinked-friend" } as User), []);
    assert.ok(!requestedTokens.includes(""), "no anonymous or unscoped Plex call");
    const batch = await batchTmdbIds(config, user.plexServerToken!, ["56-9"]);
    assert.deepEqual(batch.get("56-9")?.episode, { season: 1, episode: 9, hasMedia: true });

    const friend = { ...user, id: "friend", username: "friend" } as User;
    setWatchedEpisodes(friend.id, [{ tmdbId: 241372, season: 1, episode: 1 }], true);
    candidate = 2;
    assert.equal((await listOnDeckEntries(friend))[0]?.episodeNumber, 2);
    const seasons = [{ seasonNumber: 1, name: "Season 1", monitored: true, episodes: Array.from({ length: 8 }, (_, i) => ({
      seasonNumber: 1, episodeNumber: i + 1, title: `Episode ${i + 1}`, airDate: null,
      monitored: true, status: "available" as const, activeInfoHash: null,
      file: i === 1 ? null : { path: `/media/56-${i + 1}.mkv` } as any,
      plexRatingKey: i === 1 ? null : `56-${i + 1}`,
    })) }];
    updateSeries("sr_56", { seasons });
    candidate = 3;
    assert.deepEqual(await listOnDeckEntries(friend), [], "do not bypass missing E02 for Plex E03");
    offset = 60_000;
    assert.equal((await listOnDeckEntries(friend))[0]?.episodeNumber, 3, "valid in-progress episode wins");
    const { session } = openPlaybackSession("local-friend", { ratingKey: "sr_56:s1e2", mediaId: "sr_56:s1e2", mediaType: "episode", durationMs: 2_400_000 });
    applySeek(session.id, 60_000);
    assert.deepEqual(await listOnDeckEntries({ id: "local-friend" } as User), [], "local resume without source is hidden");
    assert.equal(JSON.stringify(getWatchStatus(user.id)), before);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
