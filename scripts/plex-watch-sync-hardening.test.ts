import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCanonical } from "@/lib/plex/mediaIdentityMap";
import { resolvedEpisodeCanonical } from "@/lib/plex/episodeResolver";

test("un résultat épisode UNRESOLVED ne fournit jamais de canonical", () => {
  const result = resolvedEpisodeCanonical({
    status: "UNRESOLVED",
    reason: "UNRESOLVED_MEDIA_NOT_FOUND",
  });
  assert.equal(result, null);
});

test("le diagnostic canonical d'un épisode contient série, saison et épisode", () => {
  assert.equal(
    formatCanonical({ type: "episode", tmdbShowId: 43017, seasonNumber: 2, episodeNumber: 4 }),
    "episode:43017:S2E4",
  );
});

test("le format movie canonical reste stable", () => {
  assert.equal(formatCanonical({ type: "movie", tmdbId: 42 }), "movie:42");
});
