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
  const type = body.type === "series" ? "series" : "movie";
  const tmdbId = Number(body.tmdbId);
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });

  const item = addWatchlistItem({
    userId: user.id,
    type,
    tmdbId,
    title: String(body.title ?? ""),
    year: body.year ?? null,
    posterPath: body.posterPath ?? null,
    rating: Number(body.rating ?? 0),
    addedAt: Date.now(),
  });
  return NextResponse.json(item, { status: 201 });
}
