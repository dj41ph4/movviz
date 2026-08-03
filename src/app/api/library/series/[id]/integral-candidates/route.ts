import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { profileFor, searchCompleteSeriesCandidates } from "@/lib/library/autoGrabSeries";

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

  const found = await searchCompleteSeriesCandidates(series, profileFor(series.qualityProfileId));
  const candidates = found?.candidates ?? [];

  return NextResponse.json({
    candidates: candidates.map((c) => c.release),
    seasonCount: found?.seasonCount ?? 0,
    episodeCount: found?.targets.length ?? 0,
  });
}
