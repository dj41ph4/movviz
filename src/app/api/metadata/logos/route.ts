import { NextRequest, NextResponse } from "next/server";
import { getCompanyLogo, getWatchProviderTiles, resolveWatchRegion, tmdbConfigured } from "@/lib/metadata/tmdb";
import { MOVIE_STUDIOS } from "@/lib/metadata/curated";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ tiles: [] });
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind === "watchProvider") {
    const region = resolveWatchRegion(requireUser(req)?.id);
    return NextResponse.json({ tiles: await getWatchProviderTiles(region) });
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
