import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAndGrabSeason } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; season: string }> };

/** Manual "search this season" trigger — tries a pack, falls back per
 *  episode. Queued (see the movie search route for why) instead of holding
 *  the request open for the whole search+grab. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, season } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title} — S${season}`, 1, async (setProgress) => {
    await searchAndGrabSeason(id, Number(season));
    setProgress(1, 1);
  }, `season-search-${id}-${season}`);
  return NextResponse.json({ queued: true });
}
