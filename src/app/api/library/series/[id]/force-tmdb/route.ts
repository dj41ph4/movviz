import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { resyncAnimeSeasonsFromTvdb } from "@/lib/library/autoGrabSeries";
import { getSeries, updateSeries } from "@/lib/library/store";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { plexConfigured, loadPlexConfig } from "@/lib/plex/store";
import { applyPendingPlexOrdering } from "@/lib/plex/librarySync";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * « Forcer TMDb » on a title's page — for a show whose TVDB structure the
 * user doesn't want. `enabled: true` records the choice (from then on no
 * automatic TVDB resync touches the series), puts it back in TMDb numbering
 * right away (files renamed, « Vu » carried over, exactly like a resync) and
 * asks Plex for TMDb order — applied at once when Plex is reachable, by the
 * next Plex sync otherwise (Plex is optional). `enabled: false` only lifts
 * the choice: the TVDB resync button comes back, nothing else moves.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (series.tmdbId === BLEACH_TMDB_ID) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });

  if (body.enabled === false) {
    updateSeries(id, { forceTmdbOrder: undefined });
    return NextResponse.json({ ok: true, forced: false });
  }

  updateSeries(id, { forceTmdbOrder: true });
  const result = await resyncAnimeSeasonsFromTvdb(id, { forceTmdb: true });
  // The choice stays recorded even when the conversion has to wait (a
  // download in progress, TVDB unreachable while files still carry its
  // numbers): the daily passes finish it, always towards TMDb.
  if (!result.ok) return NextResponse.json({ ok: true, forced: true, pending: result.error });

  let plexOrder: "applied" | "pending" | "none" = "none";
  const after = getSeries(id);
  if (after?.plexOrderPending) {
    plexOrder = "pending";
    if (plexConfigured()) {
      const cfg = loadPlexConfig();
      if (cfg.adminToken) {
        await applyPendingPlexOrdering(cfg, cfg.adminToken, Number.MAX_SAFE_INTEGER).catch(() => 0);
        if (!getSeries(id)?.plexOrderPending) plexOrder = "applied";
      }
    }
  }
  return NextResponse.json({ ...result, forced: true, plexOrder });
}
