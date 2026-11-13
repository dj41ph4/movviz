import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeResumeEntries } from "@/lib/playback/resumeList";

test("resumeList garde la lecture la plus récente d'un même épisode enregistré deux fois", () => {
  const result = dedupeResumeEntries([
    { ratingKey: "1630634", mediaType: "episode", tmdbId: 2098, seasonNumber: 1, episodeNumber: 3, lastPlayedAt: 100, resumeOffsetMs: 190_228 },
    { ratingKey: "439452", mediaType: "episode", tmdbId: 241372, seasonNumber: 1, episodeNumber: 1, lastPlayedAt: 200, resumeOffsetMs: 339_064 },
    { ratingKey: "1630634", mediaType: "episode", tmdbId: 2098, seasonNumber: 1, episodeNumber: 3, lastPlayedAt: 300, resumeOffsetMs: 767_502 },
  ]);
  assert.deepEqual(result.map((entry) => entry.resumeOffsetMs), [767_502, 339_064]);
});

test("resumeList réunit la clé Plex et l'identifiant Movviz d'un même titre, sans mêler deux épisodes", () => {
  const result = dedupeResumeEntries([
    { ratingKey: "sr_abc:s1e3", mediaType: "episode", tmdbId: 2098, seasonNumber: 1, episodeNumber: 3, lastPlayedAt: 50 },
    { ratingKey: "1630634", mediaType: "episode", tmdbId: 2098, seasonNumber: 1, episodeNumber: 3, lastPlayedAt: 40 },
    { ratingKey: "1630635", mediaType: "episode", tmdbId: 2098, seasonNumber: 1, episodeNumber: 4, lastPlayedAt: 30 },
    { ratingKey: "mv_x", mediaType: "movie", tmdbId: 21208, lastPlayedAt: 20 },
    { ratingKey: "777", mediaType: "movie", tmdbId: 21208, lastPlayedAt: 10 },
    { ratingKey: "888", mediaType: "movie", lastPlayedAt: 5 },
  ]);
  assert.deepEqual(result.map((entry) => entry.ratingKey), ["sr_abc:s1e3", "1630635", "mv_x", "888"]);
});
