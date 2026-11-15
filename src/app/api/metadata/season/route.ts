import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSeason, tmdbConfigured } from "@/lib/metadata/tmdb";
import { getSeriesByTmdbId } from "@/lib/library/store";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { tvdbOrderedSeries, projectSeason } from "@/lib/library/tvdbProjection";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!tmdbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 400 });
  const tmdbId = Number(req.nextUrl.searchParams.get("tmdbId"));
  const seasonNumber = Number(req.nextUrl.searchParams.get("season"));
  if (!tmdbId || !Number.isFinite(seasonNumber)) {
    return NextResponse.json({ error: "tmdbId and season required" }, { status: 400 });
  }
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;

  // TVDB-numbered library series: Movviz's structure, TMDb only for stills.
  const tvdbSeries = tvdbOrderedSeries(tmdbId);
  if (tvdbSeries) {
    const projected = await projectSeason(tvdbSeries, seasonNumber, locale);
    if (!projected) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(projected);
  }
  const library = tmdbId === BLEACH_TMDB_ID ? getSeriesByTmdbId(tmdbId) : null;
  const season = await getSeason(tmdbId, seasonNumber, locale, library && needsBleachRepair(library) ? { bleachOrder: "tmdb" } : undefined);
  if (!season) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(season);
}
