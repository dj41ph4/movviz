import { NextRequest, NextResponse } from "next/server";
import { searchAndGrabCompleteSeries } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  enqueueJob("qualityUpgrade", `Intégrale : ${series.title}`, 1, async (setProgress) => {
    await searchAndGrabCompleteSeries(id);
    setProgress(1, 1);
  }, `series-complete-search-${id}`);
  return NextResponse.json({ queued: true });
}
