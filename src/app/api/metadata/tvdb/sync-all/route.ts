import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeries } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { tvdbConfigured } from "@/lib/metadata/tvdb";
import { resyncAnimeSeasonsFromTvdb, backfillMissingSeason0FromTmdb } from "@/lib/library/autoGrabSeries";
import { enqueueJob, isSourceActive } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

const SOURCE_ID = "tvdb-sync-all";

/**
 * Runs as a background job, not an inline request/response — a real library
 * (thousands of titles, one TMDb fetch each just to check isAnime) takes far
 * longer than a reverse proxy's request timeout, which used to abort the
 * whole scan client-side as a bare "network_error" partway through with zero
 * of it actually applied. Progress/result are polled via /api/jobs instead.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!tvdbConfigured()) {
    return NextResponse.json({ error: "tvdb_not_configured" }, { status: 400 });
  }

  if (isSourceActive(SOURCE_ID)) {
    return NextResponse.json({ queued: true });
  }

  const job = enqueueJob(
    "metadataRefresh",
    "Resynchronisation TVDB de tous les animes",
    1,
    async (setProgress) => {
      const all = loadSeries();
      const results: { seriesId: string; title: string; ok: boolean; error?: string; oldSeasonCount?: number; newSeasonCount?: number }[] = [];
      let specialsBackfilled = 0;

      let checked = 0;
      for (const series of all) {
        checked++;
        setProgress(checked, all.length);
        const meta = await fetchTmdbSeries(series.tmdbId).catch(() => null);
        if (!meta?.isAnime) {
          // Non-anime series never go through the TVDB path at all, but
          // still deserve the same specials backfill anime gets from the
          // richer resync below — sourced from TMDb instead since that's
          // already every non-anime series' metadata source.
          const backfill = await backfillMissingSeason0FromTmdb(series.id).catch(() => null);
          if (backfill?.added) specialsBackfilled++;
          continue;
        }

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

      return {
        total: all.length,
        animeFound: results.length,
        synced: synced.length,
        skipped: skipped.length,
        specialsBackfilled,
        details: results,
      };
    },
    SOURCE_ID
  );

  return NextResponse.json({ queued: true, jobId: job.id });
}
