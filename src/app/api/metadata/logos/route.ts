import { NextRequest, NextResponse } from "next/server";
import { getCompanyLogo, getWatchProviderTiles, tmdbConfigured } from "@/lib/metadata/tmdb";
import { MOVIE_STUDIOS } from "@/lib/metadata/curated";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ tiles: [] });
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind === "watchProvider") {
    return NextResponse.json({ tiles: await getWatchProviderTiles() });
  }
  const tiles = await Promise.all(
    MOVIE_STUDIOS.map(async (s) => ({
      id: s.id,
      name: s.name,
      logoPath: await getCompanyLogo(s.id),
    }))
  );
  return NextResponse.json({ tiles });
}
