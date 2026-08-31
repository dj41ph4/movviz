import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { applyHeartbeat, getPlaybackProgress, getPlaybackSession } from "@/lib/playback/progressStore";
import { pushMovieWatchedToPlex, pushEpisodesWatchedToPlex } from "@/lib/plex/watchWrite";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params; const session = getPlaybackSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const wasWatched = getPlaybackProgress(user.id, session.ratingKey)?.watched === true;
  const p = applyHeartbeat(sessionId, { sequence: Number(b?.sequence) || 0, positionMs: Number(b?.positionMs) || 0, isPlaying: b?.isPlaying === true, playbackRate: Number(b?.playbackRate) || 1 });
  if (!wasWatched && p.watched && p.tmdbId != null) {
    if (p.mediaType === "movie") void pushMovieWatchedToPlex(user, p.tmdbId, true);
    else if (p.seasonNumber != null && p.episodeNumber != null) void pushEpisodesWatchedToPlex(user, [{ tmdbId: p.tmdbId, season: p.seasonNumber, episode: p.episodeNumber }], true);
  }
  return NextResponse.json({ watched: p.watched, resumeOffsetMs: p.watched ? null : p.resumeOffsetMs, eligibleForResume: p.eligibleForResume, actualPlayedMs: p.actualPlayedMs, revision: p.revision });
}
