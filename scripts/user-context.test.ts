import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUnifiedUserContext } from "@/lib/userContext/query";
import type { UnifiedUserContextSnapshot } from "@/lib/userContext/types";

test("unified context formats exact resume and series progress without inventing data", () => {
  const snapshot: UnifiedUserContextSnapshot = {
    generatedAt: 1_000,
    storageAvailable: true,
    currentWatching: [{
      tmdbId: 1,
      mediaType: "episode",
      title: "Baki",
      seasonNumber: 2,
      episodeNumber: 7,
      positionMs: 1_122_000,
      durationMs: 1_458_000,
      progressRatio: 1_122_000 / 1_458_000,
      lastPlayedAt: 900,
    }],
    seriesProgress: [{
      tmdbId: 1,
      title: "Baki",
      seasonNumber: 2,
      completedEpisodes: 6,
      lastCompleted: { season: 2, episode: 6 },
      current: {
        season: 2,
        episode: 7,
        positionMs: 1_122_000,
        durationMs: 1_458_000,
        progressRatio: 1_122_000 / 1_458_000,
        lastPlayedAt: 900,
      },
      next: { season: 2, episode: 8 },
      seasonStats: { season: 2, watched: 6, total: 13 },
    }],
    recentWatched: [{
      tmdbId: 2,
      mediaType: "movie",
      title: "The Thing",
      watchedAt: Date.UTC(2026, 7, 30, 21, 0, 0),
      genres: ["Horror", "Science Fiction"],
    }],
  };

  const text = formatUnifiedUserContext(snapshot);
  assert.match(text, /Baki S02E07/);
  assert.match(text, /18:42\/24:18/);
  assert.match(text, /dernier fini S02E06/);
  assert.match(text, /6\/13 vus dans S02/);
  assert.match(text, /The Thing \[Horror\/Science Fiction\]/);
});
