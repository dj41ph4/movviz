import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAndGrabEpisode } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; season: string; episode: string }> };

/** Manual "search this episode" trigger. Queued instead of holding the
 *  request open for the whole search+grab (see the movie search route). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, season, episode } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title} — S${season}E${episode}`, 1, async (setProgress) => {
    await searchAndGrabEpisode(id, Number(season), Number(episode));
    setProgress(1, 1);
  }, `episode-search-${id}-${season}-${episode}`);
  return NextResponse.json({ queued: true });
}
