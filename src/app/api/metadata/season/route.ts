import { NextRequest, NextResponse } from "next/server";
import { getSeason, tmdbConfigured } from "@/lib/metadata/tmdb";
import { getSeriesByTmdbId } from "@/lib/library/store";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 400 });
  const tmdbId = Number(req.nextUrl.searchParams.get("tmdbId"));
  const seasonNumber = Number(req.nextUrl.searchParams.get("season"));
  if (!tmdbId || !Number.isFinite(seasonNumber)) {
    return NextResponse.json({ error: "tmdbId and season required" }, { status: 400 });
  }
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;

  const library = tmdbId === BLEACH_TMDB_ID ? getSeriesByTmdbId(tmdbId) : null;
  const season = await getSeason(tmdbId, seasonNumber, locale, library && needsBleachRepair(library) ? { bleachOrder: "tmdb" } : undefined);
  if (!season) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(season);
}
