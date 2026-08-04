import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeries, updateSeries, loadMovies, updateMovie } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries, getMovie as fetchTmdbMovie } from "@/lib/metadata/tmdb";
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

  // Deliberately NOT gated on tvdbConfigured() as a whole: originalTitle and
  // specials backfill below only ever need TMDb, which is always available.
  // Only the anime-specific TVDB resync step (further down) skips itself
  // when TVDB isn't configured — a household that never set up TVDB must
  // still get the other two backfills, not silently none of them.
  const tvdbReady = tvdbConfigured();

  if (isSourceActive(SOURCE_ID)) {
    return NextResponse.json({ queued: true });
  }

  const job = enqueueJob(
    "metadataRefresh",
    "Resynchronisation TVDB de tous les animes",
    1,
    async (setProgress) => {
      const all = loadSeries();
      const movies = loadMovies();
      const results: { seriesId: string; title: string; ok: boolean; error?: string; oldSeasonCount?: number; newSeasonCount?: number }[] = [];
      let specialsBackfilled = 0;
      let moviesOriginalTitleBackfilled = 0;

      // Movies never go through the TVDB/specials logic below — this pass
      // only exists to backfill originalTitle (see the series loop's
      // comment) for the movie side too, piggybacked onto this same
      // background job rather than a second one.
      let moviesChecked = 0;
      for (const movie of movies) {
        moviesChecked++;
        setProgress(moviesChecked, movies.length + all.length);
        if (movie.originalTitle != null) continue;
        const meta = await fetchTmdbMovie(movie.tmdbId).catch(() => null);
        if (meta?.originalTitle) {
          updateMovie(movie.id, { originalTitle: meta.originalTitle });
          moviesOriginalTitleBackfilled++;
        }
      }

      let checked = 0;
      for (const series of all) {
        checked++;
        setProgress(moviesChecked + checked, movies.length + all.length);
        const meta = await fetchTmdbSeries(series.tmdbId).catch(() => null);
        // Free backfill: this fetch already happens for every series in this
        // loop regardless of anime status, so persisting originalTitle costs
        // nothing extra — needed by recoverDownloads.ts's orphan-file
        // matching for any show whose French display title diverges from
        // the original name a scene release is actually named after.
        if (meta?.originalTitle && series.originalTitle == null) {
          updateSeries(series.id, { originalTitle: meta.originalTitle });
        }
        if (!meta?.isAnime || !tvdbReady) {
          // Non-anime series never go through the TVDB path at all, but
          // still deserve the same specials backfill anime gets from the
          // richer resync below — sourced from TMDb instead since that's
          // already every non-anime series' metadata source. Anime series
          // fall into this same branch when TVDB isn't configured — same
          // TMDb-only backfill, just skipping the richer TVDB resync it
          // would otherwise get.
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
        moviesOriginalTitleBackfilled,
        details: results,
      };
    },
    SOURCE_ID
  );

  return NextResponse.json({ queued: true, jobId: job.id });
}
