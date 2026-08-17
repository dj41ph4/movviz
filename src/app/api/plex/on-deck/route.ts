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
  const items: OnDeckEntry[] = [];
  for (const d of onDeck) {
    if (!d.duration) continue;
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
