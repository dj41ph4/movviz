import assert from "node:assert/strict";
import { test } from "node:test";
import { isEarlierEpisode, isNextUnwatchedEpisode } from "../src/lib/plex/onDeckPolicy.ts";

test("a newly aired season returns to On Deck after the previous season was watched", () => {
  assert.equal(
    isNextUnwatchedEpisode(
      { tmdbId: 44006, season: 14, episode: 1 },
      { episodes: [{ tmdbId: 44006, season: 13, episode: 22 }] },
    ),
    true,
  );
});

test("a zero-offset episode is rejected for a never-started or already watched series", () => {
  assert.equal(isNextUnwatchedEpisode({ tmdbId: 44006, season: 14, episode: 1 }, null), false);
  assert.equal(
    isNextUnwatchedEpisode(
      { tmdbId: 44006, season: 14, episode: 1 },
      { episodes: [{ tmdbId: 44006, season: 14, episode: 1 }] },
    ),
    false,
  );
});

test("the first unstarted season wins when several future seasons are downloaded", () => {
  assert.equal(isEarlierEpisode({ season: 5, episode: 1 }, { season: 6, episode: 1 }), true);
  assert.equal(isEarlierEpisode({ season: 6, episode: 1 }, { season: 5, episode: 1 }), false);
});
