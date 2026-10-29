import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { removeFromContinueWatchingOnPlex } from "@/lib/plex/watchWrite";
import { clearPlaybackProgress } from "@/lib/playback/progressStore";
import { emitWatchChanged } from "@/lib/events/watchEvents";
import { getMovie, getMovieByPlexRatingKey } from "@/lib/library/store";
import { resolvePlaybackEpisode } from "@/lib/playback/episodeIdentity";
import { dismissFromResume, resumeIdentity } from "@/lib/playback/resumeDismissals";

export const dynamic = "force-dynamic";

/**
 * "Retirer de la liste Reprendre" — Reprendre row's dropdown menu (confirmed
 * live, distinct from marking watched). An on-deck item can come from either
 * source /api/plex/on-deck reads (real Plex On Deck, or Movviz's own local
 * progressStore for the beta player) — cleared in both places since the
 * caller has no reliable way to know which one produced this specific item.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { plexRatingKey?: unknown; movvizId?: unknown } | null;
  const plexRatingKey = typeof body?.plexRatingKey === "string" && body.plexRatingKey ? body.plexRatingKey : null;
  const movvizId = typeof body?.movvizId === "string" ? body.movvizId : undefined;
  // Plex est facultatif : le titre se retrouve aussi par son identifiant Movviz.
  if (!plexRatingKey && !movvizId) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const movie = (movvizId ? getMovie(movvizId) : null) ?? (plexRatingKey ? getMovieByPlexRatingKey(plexRatingKey) : null);
  const episode = movie ? null : resolvePlaybackEpisode(plexRatingKey ?? "", movvizId);
  const identity = movie ? resumeIdentity("movie", movie.tmdbId) : episode ? resumeIdentity("series", episode.series.tmdbId) : null;
  if (identity) dismissFromResume(user.id, identity);

  clearPlaybackProgress(user.id, plexRatingKey ?? movvizId ?? "", movvizId);
  // The user's other devices reload Reprendre once Plex has dropped it too
  // (reloading before would still find it there).
  if (!plexRatingKey) {
    emitWatchChanged(user.id);
    return NextResponse.json({ ok: true });
  }
  removeFromContinueWatchingOnPlex(user, plexRatingKey)
    .catch(() => {})
    .finally(() => emitWatchChanged(user.id));
  return NextResponse.json({ ok: true });
}
