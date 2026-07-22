import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadRequests } from "@/lib/requests/store";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import type { LibraryStatus, LibrarySeries } from "@/lib/library/types";

export const dynamic = "force-dynamic";

function overallSeriesStatus(series: LibrarySeries): LibraryStatus {
  const episodes = series.seasons.flatMap((s) => s.episodes).filter((e) => e.monitored);
  if (episodes.length === 0) return "missing";
  if (episodes.every((e) => e.status === "available")) return "available";
  if (episodes.some((e) => e.status === "downloading" || e.status === "searching")) return "downloading";
  if (episodes.some((e) => e.status === "available")) return "downloading";
  return "missing";
}

/**
 * Admins see every request; regular users only see their own. Approved
 * requests carry the live library status of the media so the list can badge
 * "still searching / downloading / available" instead of a flat "approved".
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManage = user.role === "admin" || user.canManageRequests;
  const all = loadRequests();
  const visible = canManage ? all : all.filter((r) => r.userId === user.id);
  const requests = visible.map((r) => {
    if (r.status !== "approved") return r;
    const mediaStatus: LibraryStatus | null =
      r.type === "movie"
        ? getMovieByTmdbId(r.tmdbId)?.status ?? null
        : (() => {
            const s = getSeriesByTmdbId(r.tmdbId);
            return s ? overallSeriesStatus(s) : null;
          })();
    return { ...r, mediaStatus };
  });
  return NextResponse.json({ requests, isAdmin: canManage });
}
