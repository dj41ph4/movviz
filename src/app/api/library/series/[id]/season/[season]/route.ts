import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries, updateSeries } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; season: string }> };

/**
 * Follow / unfollow one season. Auto-grab paths gate on `season.monitored`,
 * others on `episode.monitored` — both are flipped together so an unfollowed
 * season is never searched or downloaded automatically again. Episodes
 * already on disk keep their flag so the season's counts stay intact.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, season } = await params;
  const seasonNumber = Number(season);
  const body = await req.json().catch(() => ({}));
  if (!Number.isInteger(seasonNumber) || typeof body.monitored !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const monitored: boolean = body.monitored;
  return withKeyLock(`series:${id}`, async () => {
    const current = getSeries(id);
    if (!current) return NextResponse.json({ error: "series not found" }, { status: 404 });
    if (!current.seasons.some((s) => s.seasonNumber === seasonNumber)) {
      return NextResponse.json({ error: "season_not_found" }, { status: 404 });
    }
    const seasons = current.seasons.map((s) =>
      s.seasonNumber === seasonNumber ? { ...s, monitored, episodes: s.episodes.map((e) => (e.status === "available" && !monitored ? e : { ...e, monitored })) } : s,
    );
    const updated = updateSeries(id, { seasons });
    return updated ? NextResponse.json({ ok: true, monitored }) : NextResponse.json({ error: "not found" }, { status: 404 });
  });
}
