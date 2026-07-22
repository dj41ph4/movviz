import { NextRequest, NextResponse } from "next/server";
import { getCompanyLogo, getNetworkLogo, tmdbConfigured } from "@/lib/metadata/tmdb";
import { MOVIE_STUDIOS, TV_NETWORKS } from "@/lib/metadata/curated";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ tiles: [] });
  const kind = req.nextUrl.searchParams.get("kind") === "network" ? "network" : "company";
  const source = kind === "network" ? TV_NETWORKS : MOVIE_STUDIOS;
  const tiles = await Promise.all(
    source.map(async (s) => ({
      id: s.id,
      name: s.name,
      logoPath: await (kind === "network" ? getNetworkLogo(s.id) : getCompanyLogo(s.id)),
    }))
  );
  return NextResponse.json({ tiles });
}
