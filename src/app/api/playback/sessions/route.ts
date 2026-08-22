import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { openPlaybackSession } from "@/lib/playback/progressStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const ratingKey = typeof body?.ratingKey === "string" ? body.ratingKey.trim() : "";
  const mediaType = body?.mediaType === "episode" ? "episode" : body?.mediaType === "movie" ? "movie" : null;
  const durationMs = Number(body?.durationMs);
  if (!ratingKey || !mediaType || !Number.isFinite(durationMs) || durationMs <= 0) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
  const result = openPlaybackSession(user.id, { ratingKey, mediaType, durationMs, tmdbId: Number.isInteger(Number(body?.tmdbId)) ? Number(body.tmdbId) : undefined, seasonNumber: Number.isInteger(Number(body?.seasonNumber)) ? Number(body.seasonNumber) : undefined, episodeNumber: Number.isInteger(Number(body?.episodeNumber)) ? Number(body.episodeNumber) : undefined, title: typeof body?.title === "string" ? body.title.slice(0, 200) : undefined });
  return NextResponse.json({ sessionId: result.session.id, resumeOffsetMs: result.progress.watched ? null : result.progress.resumeOffsetMs, watched: result.progress.watched, eligibleForResume: result.progress.eligibleForResume, completionBoundaryMs: result.progress.completionBoundaryMs, boundarySource: result.progress.boundarySource });
}
