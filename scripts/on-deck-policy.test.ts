import assert from "node:assert/strict";
import { test } from "node:test";
import { isEarlierEpisode, isNextUnwatchedEpisode, availableEpisode, nextAvailableEpisode } from "../src/lib/plex/onDeckPolicy.ts";
import type { LibrarySeason } from "../src/lib/library/types.ts";

const season = (number: number, count: number): LibrarySeason => ({
  seasonNumber: number, name: `Season ${number}`, monitored: true,
  episodes: Array.from({ length: count }, (_, i) => ({
    seasonNumber: number, episodeNumber: i + 1, title: `Episode ${i + 1}`,
    airDate: null, monitored: true, status: "available", file: null,
    activeInfoHash: null, plexRatingKey: `${number}-${i + 1}`,
  })),
});

test("eight completed episodes never manufacture episode nine", () => {
  const seasons = [season(1, 8)];
  assert.equal(nextAvailableEpisode(seasons, () => true), null);
  assert.equal(availableEpisode(seasons, 1, 9), null);
});

test("an absent successor blocks later available episodes and seasons", () => {
  const first = season(1, 3);
  first.episodes[1].plexRatingKey = null;
  assert.equal(nextAvailableEpisode([season(2, 1), first], (s, e) => s === 1 && e === 1), null);
  assert.equal(availableEpisode([first], 1, 2), null);
  // A real episode already in progress stays playable despite the earlier gap.
  assert.equal(availableEpisode([first], 1, 3)?.episode.episodeNumber, 3);
});

test("the real next episode follows season/episode order without mutating the catalogue", () => {
  const first = season(1, 8);
  first.episodes.reverse();
  const seasons = [season(2, 1), first];
  const before = JSON.stringify(seasons);
  const next = nextAvailableEpisode(seasons, (s, e) => s === 1 && e <= 7);
  assert.equal(next?.episode.episodeNumber, 8);
  assert.equal(nextAvailableEpisode(seasons, (s) => s === 1)?.season.seasonNumber, 2);
  assert.equal(JSON.stringify(seasons), before);
});

test("watch predicates are profile-specific", () => {
  const seasons = [season(1, 8)];
  assert.equal(nextAvailableEpisode(seasons, () => true), null);
  assert.equal(nextAvailableEpisode(seasons, (_, e) => e < 3)?.episode.episodeNumber, 3);
});

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
