import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchlistItem, removeWatchlistItem } from "@/lib/watchlist/store";
import { removePlexWatchlistItem } from "@/lib/plex/client";
import { parseBleachSeriesPart } from "@/lib/library/bleachScope";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ type: string; id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { type, id } = await params;
  if (type !== "movie" && type !== "series" && type !== "episode") return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
  const url = new URL(req.url);
  const partParam = url.searchParams.get("seriesPart");
  const part = parseBleachSeriesPart(partParam);
  if (partParam != null && (!part || type !== "series" || tmdbId !== 30984)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  const season = url.searchParams.get("season");
  const episode = url.searchParams.get("episode");
  const seasonNumber = season == null ? undefined : Number(season);
  const episodeNumber = episode == null ? undefined : Number(episode);
  if (type === "episode" && (seasonNumber == null || episodeNumber == null || !Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0)) return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  const existing = getWatchlistItem(user.id, type, tmdbId, seasonNumber, episodeNumber, part ?? undefined);
  removeWatchlistItem(user.id, type, tmdbId, seasonNumber, episodeNumber, Date.now(), part ?? undefined);
  if (existing?.plexDiscoverRatingKey && user.plexToken) removePlexWatchlistItem(user.plexToken, existing.plexDiscoverRatingKey).catch(() => {});
  return NextResponse.json({ removed: true });
}
