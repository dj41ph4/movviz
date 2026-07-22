import { NextRequest, NextResponse } from "next/server";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Manual "search this series" trigger — searches every monitored season
 *  that still has missing episodes. Queued (see the movie search route for
 *  why) instead of holding the request open for the whole search+grab. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title}`, 1, async (setProgress) => {
    await searchAndGrabSeries(id);
    setProgress(1, 1);
  }, `series-search-${id}`);
  return NextResponse.json({ queued: true });
}
