import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { openPlaybackSession } from "@/lib/playback/progressStore";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexOnDeck } from "@/lib/plex/client";
import { resolveToken } from "@/lib/plex/watchWrite";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const ratingKey = typeof body?.ratingKey === "string" ? body.ratingKey.trim() : "";
  const mediaId = typeof body?.mediaId === "string" && body.mediaId.trim() ? body.mediaId.trim() : undefined;
  const mediaType = body?.mediaType === "episode" ? "episode" : body?.mediaType === "movie" ? "movie" : null;
  const durationMs = Number(body?.durationMs);
  if (!ratingKey || !mediaType || !Number.isFinite(durationMs) || durationMs <= 0) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
  const result = openPlaybackSession(user.id, { ratingKey, mediaId, mediaType, durationMs, tmdbId: Number.isInteger(Number(body?.tmdbId)) ? Number(body.tmdbId) : undefined, seasonNumber: Number.isInteger(Number(body?.seasonNumber)) ? Number(body.seasonNumber) : undefined, episodeNumber: Number.isInteger(Number(body?.episodeNumber)) ? Number(body.episodeNumber) : undefined, title: typeof body?.title === "string" ? body.title.slice(0, 200) : undefined });
  // Plex is the second source of truth for resume. A user can pause on Plex
  // and immediately continue in Movviz (or the reverse), so do not show the
  // stale local timestamp while opening a session. This is best-effort and
  // never blocks local playback when Plex is unavailable.
  let resumeOffsetMs = result.progress.watched ? null : result.progress.resumeOffsetMs;
  if (!result.progress.watched) {
    try {
      const cfg = loadPlexConfig();
      const auth = cfg.hostname ? resolveToken(user, cfg) : null;
      if (auth) {
        const plexItem = (await getPlexOnDeck(cfg, auth.token, auth.managedUserId)).find((item) => item.ratingKey === ratingKey);
        if (plexItem && plexItem.viewOffset > 0) resumeOffsetMs = plexItem.viewOffset;
      }
    } catch { /* local progress remains authoritative when Plex is offline */ }
  }
  return NextResponse.json({ sessionId: result.session.id, resumeOffsetMs, watched: result.progress.watched, eligibleForResume: result.progress.eligibleForResume, completionBoundaryMs: result.progress.completionBoundaryMs, boundarySource: result.progress.boundarySource });
}
