import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { User } from "../src/lib/auth/types.ts";

// Règle « Plex optionnel » : un film jamais vu par Plex (plexRatingKey null) est suivi sous son id Movviz.
// Constaté en prod (2026-11-10, Plex coupé) : il était enregistré en reprise mais absent de « Reprendre ».
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-on-deck-local-movie-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
process.env.MOVVIZ_TMDB_API_KEY = "";
fs.writeFileSync(path.join(dir, "library-series.json"), "[]");

const { addMovie } = await import("../src/lib/library/store.ts");
const { listOnDeckEntries } = await import("../src/lib/plex/onDeckService.ts");
const { openPlaybackSession, applyHeartbeat } = await import("../src/lib/playback/progressStore.ts");

test("un film local sans clé Plex apparaît dans « Reprendre » sans aucune liaison Plex", async () => {
  addMovie({
    id: "mv_local_only", tmdbId: 990002, imdbId: null, title: "Local seul", year: 2020, releaseDate: "2020-01-01", vfReleaseDate: null,
    overview: "", posterPath: null, backdropPath: null, rating: 7, runtime: 120, genres: [], monitored: true, qualityProfileId: "default",
    status: "available", file: { path: "/data/films/local.mkv", quality: "WEB-DL 1080p", resolution: "1080p", videoCodec: "h264", audioCodec: "AAC", hdr: null, source: "WEB-DL", size: 1, addedAt: Date.now() },
    activeInfoHash: null, addedAt: Date.now(), plexRatingKey: null, plexMediaInfo: null,
  } as never);
  const user = { id: "u-local", username: "u-local", role: "user" } as User;
  const { session } = openPlaybackSession(user.id, { ratingKey: "mv_local_only", mediaId: "mv_local_only", mediaType: "movie", durationMs: 7_200_000, tmdbId: 990002 });
  const t0 = Date.now();
  for (let i = 1; i <= 80; i++) applyHeartbeat(session.id, { sequence: i, positionMs: 1_200_000 + i * 1000, isPlaying: true, nowMs: t0 + i * 1000 });

  const entries = await listOnDeckEntries(user, { includeStills: false });
  const entry = entries.find((item) => item.tmdbId === 990002);
  assert.ok(entry, "le film local doit figurer dans Reprendre");
  assert.equal(entry.type, "movie");
  assert.equal(entry.movvizId, "mv_local_only");
});
