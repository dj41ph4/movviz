import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexOnDeck } from "@/lib/plex/client";
import { resolveToken } from "@/lib/plex/watchWrite";
import { getMovieByPlexRatingKey, findEpisodeByPlexRatingKey } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

export const dynamic = "force-dynamic";

export interface OnDeckEntry {
  type: "movie" | "episode";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
  rating: number;
  progressPercent: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
}

/**
 * "Continue Watching" data source, per-user (Plex attributes on-deck state
 * to whichever account's token asks for it — same principle as every other
 * per-user Plex read in this codebase). Only ever returns items Movviz
 * itself actually tracks (a plexRatingKey match against the library store)
 * — a Plex library item Movviz doesn't manage has no tmdbId/poster to show
 * and is silently skipped rather than surfaced half-empty.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cfg = loadPlexConfig();
  if (!cfg.hostname) return NextResponse.json({ items: [] });
  const auth = resolveToken(user, cfg);
  if (!auth) return NextResponse.json({ items: [] });

  const onDeck = await getPlexOnDeck(cfg, auth.token, auth.managedUserId);
  // Second, independent layer of per-user isolation (confirmed live: a
  // report of one account's Continue Watching row showing on a completely
  // different device/account raised real doubt about trusting Plex's own
  // per-token scoping for /library/onDeck here). This codebase has ALREADY
  // documented, elsewhere (watchSync.ts), a real Plex API quirk where
  // certain endpoints return the SERVER OWNER's state no matter which
  // account's token authenticates the request — /library/onDeck is not
  // proven safe from the same quirk. Rather than trust it blindly, cross-
  // check every item against this user's OWN watch data, which IS already
  // independently confirmed correctly per-account-scoped (synced via
  // /status/sessions/history/all?accountID=, watchSync.ts) — an on-deck
  // item only survives if this exact user has some real record of having
  // watched/started it. A mismatch is logged rather than silently dropped,
  // so a recurrence has real evidence instead of another guess.
  const status = getWatchStatus(user.id);
  const ownedMovieIds = new Set(status?.movies ?? []);
  const ownedSeriesIds = new Set((status?.episodes ?? []).map((e) => e.tmdbId));
  const recentIds = new Set((status?.recent ?? []).map((r) => `${r.type}:${r.tmdbId}`));
  const belongsToUser = (type: "movie" | "series", tmdbId: number) =>
    (type === "movie" ? ownedMovieIds.has(tmdbId) : ownedSeriesIds.has(tmdbId)) || recentIds.has(`${type}:${tmdbId}`);

  const items: OnDeckEntry[] = [];
  for (const d of onDeck) {
    // Bug fix (confirmed live): Plex's on-deck list mixes two different
    // things — content actually paused mid-playback, AND the "next episode
    // up" for any show with watch history, queued at 0% before anyone has
    // even started it. Only the first one is "Continue Watching" — the
    // second flooded this row with dozens of never-started episodes, each
    // showing an empty progress bar, on a real account (Plex itself keeps
    // these separate in its own UI, this list just doesn't).
    if (!d.duration || d.viewOffset <= 0) continue;
    const progressPercent = Math.min(100, Math.round((d.viewOffset / d.duration) * 100));
    if (d.type === "movie") {
      const movie = getMovieByPlexRatingKey(d.ratingKey);
      if (!movie) continue;
      if (!belongsToUser("movie", movie.tmdbId)) {
        recordSearchLog("warn", "plex.onDeck", `${user.username}: item on-deck « ${movie.title} » ignoré — aucune trace dans l'historique de vue propre à ce compte (Plex a peut-être renvoyé les données du propriétaire du serveur au lieu de ce compte)`);
        continue;
      }
      items.push({
        type: "movie",
        tmdbId: movie.tmdbId,
        title: movie.title,
        posterPath: movie.posterPath,
        year: movie.year,
        rating: movie.rating,
        progressPercent,
      });
    } else {
      const found = findEpisodeByPlexRatingKey(d.ratingKey);
      if (!found) continue;
      if (!belongsToUser("series", found.series.tmdbId)) {
        recordSearchLog("warn", "plex.onDeck", `${user.username}: item on-deck « ${found.series.title} » ignoré — aucune trace dans l'historique de vue propre à ce compte (Plex a peut-être renvoyé les données du propriétaire du serveur au lieu de ce compte)`);
        continue;
      }
      items.push({
        type: "episode",
        tmdbId: found.series.tmdbId,
        title: found.series.title,
        posterPath: found.series.posterPath,
        year: found.series.year,
        rating: found.series.rating,
        progressPercent,
        seasonNumber: found.season.seasonNumber,
        episodeNumber: found.episode.episodeNumber,
        episodeTitle: found.episode.title,
      });
    }
  }

  return NextResponse.json({ items });
}
