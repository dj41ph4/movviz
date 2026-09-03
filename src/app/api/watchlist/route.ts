import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadWatchlist, addWatchlistItem } from "@/lib/watchlist/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ items: loadWatchlist(user.id) });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const type = body.type === "series" || body.type === "episode" ? body.type : body.type === "movie" ? "movie" : null;
  const tmdbId = Number(body.tmdbId);
  if (!type || !Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
  const seasonNumber = body.seasonNumber == null ? null : Number(body.seasonNumber);
  const episodeNumber = body.episodeNumber == null ? null : Number(body.episodeNumber);
  if (type === "episode" && (seasonNumber == null || episodeNumber == null || !Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber <= 0)) {
    return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  }

  const item = addWatchlistItem({
    userId: user.id,
    type,
    tmdbId,
    seasonNumber,
    episodeNumber,
    title: String(body.title ?? ""),
    parentTitle: body.parentTitle ?? null,
    year: body.year ?? null,
    posterPath: body.posterPath ?? null,
    stillPath: body.stillPath ?? null,
    rating: Number(body.rating ?? 0),
    addedAt: Date.now(),
  });
  return NextResponse.json(item, { status: 201 });
}
