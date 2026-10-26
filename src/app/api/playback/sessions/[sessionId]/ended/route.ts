import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { completePlayback, getPlaybackSession } from "@/lib/playback/progressStore";
import { pushMovieWatchedToPlex, pushEpisodesWatchedToPlex } from "@/lib/plex/watchWrite";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params; const session = getPlaybackSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  const p = completePlayback(sessionId);
  // completePlayback refuses an `ended` far from the film's end (a stream
  // that stopped early): Plex must not be told « vu » for it either.
  if (p.watched && p.tmdbId != null) {
    if (p.mediaType === "movie") void pushMovieWatchedToPlex(user, p.tmdbId, true);
    else if (p.seasonNumber != null && p.episodeNumber != null) void pushEpisodesWatchedToPlex(user, [{ tmdbId: p.tmdbId, season: p.seasonNumber, episode: p.episodeNumber }], true);
  }
  return NextResponse.json({ watched: p.watched, resumeOffsetMs: p.watched ? null : p.resumeOffsetMs, revision: p.revision });
}
