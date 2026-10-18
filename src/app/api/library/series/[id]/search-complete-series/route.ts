import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAndGrabCompleteSeries } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { parseBleachSeriesPart } from "@/lib/library/bleachScope";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const part = parseBleachSeriesPart(body.seriesPart);
  if (body.seriesPart != null && (!part || series.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  if (needsBleachRepair(series)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });

  enqueueJob("qualityUpgrade", `Intégrale : ${series.title}`, 1, async (setProgress) => {
    await searchAndGrabCompleteSeries(id, part);
    setProgress(1, 1);
  }, `series-complete-search-${id}${part ? `-${part}` : ""}`);
  return NextResponse.json({ queued: true });
}
