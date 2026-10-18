import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { parseBleachSeriesPart } from "@/lib/library/bleachScope";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Manual "search this series" trigger — searches every monitored season
 *  that still has missing episodes. Queued (see the movie search route for
 *  why) instead of holding the request open for the whole search+grab. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });
  if (needsBleachRepair(series)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const seriesPart = parseBleachSeriesPart(body.seriesPart);
  if (body.seriesPart != null && (!seriesPart || series.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title}`, 1, async (setProgress) => {
    await searchAndGrabSeries(id, { seriesPart: seriesPart ?? undefined });
    setProgress(1, 1);
  }, `series-search-${id}-${seriesPart ?? "all"}`);
  return NextResponse.json({ queued: true });
}
