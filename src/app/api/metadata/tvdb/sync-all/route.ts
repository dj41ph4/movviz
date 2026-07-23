import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeries } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { tvdbConfigured } from "@/lib/metadata/tvdb";
import { resyncAnimeSeasonsFromTvdb } from "@/lib/library/autoGrabSeries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!tvdbConfigured()) {
    return NextResponse.json({ error: "tvdb_not_configured" }, { status: 400 });
  }

  const all = loadSeries();
  const results: { seriesId: string; title: string; ok: boolean; error?: string; oldSeasonCount?: number; newSeasonCount?: number }[] = [];

  for (const series of all) {
    const meta = await fetchTmdbSeries(series.tmdbId).catch(() => null);
    if (!meta?.isAnime) continue;

    const r = await resyncAnimeSeasonsFromTvdb(series.id).catch(() => null);
    if (!r) { results.push({ seriesId: series.id, title: series.title, ok: false, error: "sync_error" }); continue; }
    results.push({
      seriesId: series.id,
      title: series.title,
      ok: r.ok,
      ...(r.ok ? { oldSeasonCount: r.oldSeasonCount, newSeasonCount: r.newSeasonCount } : { error: r.error }),
    });
  }

  const synced = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);

  return NextResponse.json({
    total: all.length,
    animeFound: results.length,
    synced: synced.length,
    skipped: skipped.length,
    details: results,
  });
}
