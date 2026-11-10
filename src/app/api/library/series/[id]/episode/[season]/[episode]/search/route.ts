import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { canCompleteMissing } from "@/lib/auth/permissions";
import { searchAndGrabEpisode, withSearchLock } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { enqueueJob } from "@/lib/jobs/queue";
import { needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; season: string; episode: string }> };

/** Manual "search this episode" trigger. Queued instead of holding the
 *  request open for the whole search+grab (see the movie search route). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Complétion d'un manquant : admins et utilisateurs en acceptation automatique uniquement.
  if (!canCompleteMissing(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, season, episode } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });
  // Un utilisateur peut demander un épisode manquant ; relancer un épisode déjà présent le remplacerait (admins seulement).
  if (user.role !== "admin") {
    const target = series.seasons.find((s) => s.seasonNumber === Number(season))?.episodes.find((e) => e.episodeNumber === Number(episode));
    if (!target || target.file || target.status === "available") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (needsBleachRepair(series)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });

  enqueueJob("qualityUpgrade", `Recherche : ${series.title} — S${season}E${episode}`, 1, async (setProgress) => {
    await withSearchLock(`series:${id}`, () => searchAndGrabEpisode(id, Number(season), Number(episode)));
    setProgress(1, 1);
  }, `episode-search-${id}-${season}-${episode}`);
  return NextResponse.json({ queued: true });
}
