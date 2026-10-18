import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAndGrabSeason, withSearchLock } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";

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
  if (needsBleachRepair(series)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const bleachPart = body.bleachPart == null ? undefined : Number(body.bleachPart);
  if (bleachPart != null && (series.tmdbId !== BLEACH_TMDB_ID || Number(season) !== 17 || !Number.isInteger(bleachPart) || bleachPart < 1 || bleachPart > 4)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title} — S${season}`, 1, async (setProgress) => {
    await withSearchLock(`series:${id}`, () => searchAndGrabSeason(id, Number(season), { bleachPart }));
    setProgress(1, 1);
  }, `season-search-${id}-${season}-${bleachPart ?? "all"}`);
  return NextResponse.json({ queued: true });
}
