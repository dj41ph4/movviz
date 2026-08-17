import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexOnDeck } from "@/lib/plex/client";
import { resolveToken } from "@/lib/plex/watchWrite";
import { getMovieByPlexRatingKey, findEpisodeByPlexRatingKey } from "@/lib/library/store";

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
  // Bug fix (confirmed live, reverted): a v1.14.44 safety net cross-checked
  // every on-deck item against this user's own SYNCED watch history
  // (watchSync.ts, refreshed only every 2h from Plex's own history log)
  // before trusting it — meant to guard against a suspected Plex API quirk,
  // but it silently dropped perfectly legitimate, currently-in-progress
  // items: something just started (a few % in) hasn't crossed Plex's own
  // history-logging threshold yet, so it has no "recent" entry there even
  // though it's genuinely this user's own on-deck item. Confirmed live: the
  // admin's own Continue Watching row dropped from 10 real items to 3
  // after that fix shipped. The theoretical leak this guarded against was
  // never actually confirmed to be this specific endpoint's fault (a
  // different, unrelated bug — the SWR client cache never being cleared on
  // login/logout — already explains the reported cross-account symptom on
  // its own), so trading away real functionality for an unconfirmed
  // protection isn't the right call. Back to trusting resolveToken's own
  // per-account token scoping, same as every other per-user Plex read here.
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
