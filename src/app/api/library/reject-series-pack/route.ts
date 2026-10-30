import { after, NextRequest, NextResponse } from "next/server";
import { getEngineToken } from "@/lib/engine/token";
import { decodeLibraryRef } from "@/lib/library/types";
import { getSeries, updateSeries } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";
import { isRecentlyFailedRelease, recordFailedRelease } from "@/lib/library/failedReleases";

export const dynamic = "force-dynamic";

/** Called only for an automatically grabbed pack (intégrale, saison ou épisode) whose
 * metadata proves that none of the requested episodes exists. Replays are safe after a restart. */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-movviz-token") !== getEngineToken()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ref = decodeLibraryRef(String(body?.libraryRef ?? ""));
  const hash = String(body?.infoHash ?? "").toLowerCase();
  if (!ref || ref.kind === "movie" || !/^[a-f0-9]{40,64}$/.test(hash)) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  if (body?.retry === true) {
    if (!isRecentlyFailedRelease(hash)) return NextResponse.json({ error: "not_rejected" }, { status: 409 });
    const seriesId = ref.seriesId;
    after(async () => {
      try {
        const [{ searchAndGrabSeries }, { runBackground }] = await Promise.all([
          import("@/lib/library/autoGrabSeries"), import("@/lib/priority/lane"),
        ]);
        await runBackground(() => searchAndGrabSeries(seriesId));
      } catch (error) { console.error("[series-pack] retry failed:", error); }
    });
    return NextResponse.json({ ok: true });
  }
  const result = await withKeyLock(`series:${ref.seriesId}`, async () => {
    const series = getSeries(ref.seriesId);
    if (!series) return "missing_series";
    const count = series.seasons.flatMap((season) => season.episodes).filter((episode) => episode.status === "downloading" && episode.activeInfoHash?.toLowerCase() === hash).length;
    if (!count) return isRecentlyFailedRelease(hash) ? "already_rejected" : "claims_not_ready";
    const releaseTitle = typeof body?.releaseTitle === "string" ? body.releaseTitle.slice(0, 500) : "";
    recordFailedRelease(hash, { seriesId: ref.seriesId, releaseTitle });
    updateSeries(series.id, { seasons: series.seasons.map((season) => ({ ...season, episodes: season.episodes.map((episode) =>
      episode.status === "downloading" && episode.activeInfoHash?.toLowerCase() === hash
        ? { ...episode, status: "missing" as const, activeInfoHash: null }
        : episode) })) });
    return "rejected";
  });
  if (result === "claims_not_ready") return NextResponse.json({ error: result }, { status: 409 });
  if (result === "missing_series") return NextResponse.json({ error: result }, { status: 404 });
  return NextResponse.json({ ok: true, result });
}
