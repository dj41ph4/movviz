import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveEpisodePlayback } from "@/lib/playback/sourceResolver";
import { getLocalStreamInfo } from "@/lib/playback/localStreamInfo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { seriesId, seasonNumber: rawSeason, episodeNumber: rawEpisode } = await context.params;
  const seasonNumber = Number(rawSeason), episodeNumber = Number(rawEpisode);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
    return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  }
  const resolved = resolveEpisodePlayback(seriesId, seasonNumber, episodeNumber);
  if (!resolved.ok) return NextResponse.json({ error: resolved.code }, { status: 404 });
  let size: number | null = null;
  if (resolved.value.path) {
    try { size = fs.statSync(resolved.value.path).size; } catch { /* stream route reports availability */ }
  }
  const streamInfo = await getLocalStreamInfo(resolved.value.plexRatingKey, user.id);
  return NextResponse.json({
    seriesId, seasonNumber, episodeNumber,
    movvizId: resolved.value.movvizId,
    source: resolved.value.source,
    playable: resolved.value.source === "movviz" ? size != null : Boolean(resolved.value.plexRatingKey),
    plexRatingKey: resolved.value.plexRatingKey,
    size,
    // Markers are keyed by the Plex rating key when available. Local-only
    // episodes simply return an empty list until a marker scan links them.
    ...streamInfo,
  }, { headers: { "cache-control": "private, no-store" } });
}
