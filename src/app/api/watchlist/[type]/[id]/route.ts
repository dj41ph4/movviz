import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { removeWatchlistItem } from "@/lib/watchlist/store";

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
  const season = url.searchParams.get("season");
  const episode = url.searchParams.get("episode");
  const seasonNumber = season == null ? undefined : Number(season);
  const episodeNumber = episode == null ? undefined : Number(episode);
  if (type === "episode" && (seasonNumber == null || episodeNumber == null || !Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0)) return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  removeWatchlistItem(user.id, type, tmdbId, seasonNumber, episodeNumber);
  return NextResponse.json({ removed: true });
}
