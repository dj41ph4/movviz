import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { hasCjkText } from "@/lib/library/autoGrabSeries";
import { getTvdbEpisodesFor, type TvdbEpisode } from "@/lib/metadata/tvdb";
import { getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Debug endpoint: returns what TVDB actually gives back for an in-library
 * series, alongside the current library titles — used to diagnose why a
 * "Resynchroniser avec TVDB" run left episode titles in Japanese.
 *
 * No data is written; admin-only.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const meta = await fetchTmdbSeries(series.tmdbId);
  const tvdbEpisodes: TvdbEpisode[] = await getTvdbEpisodesFor(
    meta?.tvdbId ?? null,
    series.title,
    series.year
  );
  const tvdbByKey = new Map<string, TvdbEpisode>();
  for (const e of tvdbEpisodes) tvdbByKey.set(`${e.seasonNumber}-${e.episodeNumber}`, e);

  const rows: Array<{
    s: number;
    e: number;
    currentTitle: string;
    currentIsCjk: boolean;
    tvdbTitle: string | null;
    tvdbIsCjk: boolean;
    wouldBecome: string;
    action: string;
  }> = [];

  for (const season of series.seasons) {
    for (const ep of season.episodes) {
      const tvdb = tvdbByKey.get(`${season.seasonNumber}-${ep.episodeNumber}`) ?? null;
      const tvdbTitle = tvdb?.title ?? null;
      const tvdbIsCjk = tvdbTitle ? hasCjkText(tvdbTitle) : false;
      const currentIsCjk = hasCjkText(ep.title);

      let wouldBecome: string;
      let action: string;
      if (!ep.title) {
        if (tvdbTitle && !tvdbIsCjk) {
          wouldBecome = tvdbTitle;
          action = "replace_no_existing_with_tvdb_french";
        } else {
          wouldBecome = `Épisode ${ep.episodeNumber}`;
          action = "fallback_no_existing";
        }
      } else if (!currentIsCjk) {
        wouldBecome = ep.title;
        action = "keep_existing_not_cjk";
      } else if (tvdbTitle && !tvdbIsCjk) {
        wouldBecome = tvdbTitle;
        action = "replace_cjk_with_tvdb_french";
      } else {
        wouldBecome = `Épisode ${ep.episodeNumber}`;
        action = "fallback_existing_cjk_and_tvdb_cjk";
      }

      rows.push({
        s: season.seasonNumber,
        e: ep.episodeNumber,
        currentTitle: ep.title,
        currentIsCjk,
        tvdbTitle,
        tvdbIsCjk,
        wouldBecome,
        action,
      });
    }
  }

  return NextResponse.json({
    seriesId: id,
    title: series.title,
    tmdbId: series.tmdbId,
    tvdbId: meta?.tvdbId ?? null,
    tvdbEpisodeCount: tvdbEpisodes.length,
    rows,
  });
}