import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { profileFor, searchCompleteSeriesCandidates } from "@/lib/library/autoGrabSeries";
import { parseBleachSeriesPart, scopedBleachSeries } from "@/lib/library/bleachScope";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Lists every complete-series-pack candidate for a series — the integral
 * selection popup's data source. Reuses the exact same search/filter/scoring
 * as the automatic flow (searchCompleteSeriesCandidates is the single source
 * of truth), so what the popup offers is precisely what an auto-grab would
 * have picked.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  const partParam = req.nextUrl.searchParams.get("seriesPart");
  const part = parseBleachSeriesPart(partParam);
  if (partParam != null && (!part || series.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  const scoped = scopedBleachSeries(series, part);
  const found = await searchCompleteSeriesCandidates(scoped, profileFor(scoped.qualityProfileId));
  const candidates = found?.candidates ?? [];

  return NextResponse.json({
    candidates: candidates.map((c) => c.release),
    seasonCount: found?.seasonCount ?? 0,
    episodeCount: found?.targets.length ?? 0,
  });
}
