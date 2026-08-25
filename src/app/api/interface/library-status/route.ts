import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { libraryFilePaths, loadMovies, loadSeries } from "@/lib/library/store";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";

export const dynamic = "force-dynamic";

function seriesStatus(series: ReturnType<typeof loadSeries>[number]): string {
  const monitored = series.seasons.flatMap((season) => season.episodes).filter((episode) => episode.monitored);
  if (monitored.length === 0) return "missing";
  if (monitored.some((episode) => episode.status === "downloading" || episode.status === "searching" || episode.activeInfoHash)) return "downloading";
  if (monitored.every((episode) => episode.status === "upcoming")) return "upcoming";
  return monitored.every((episode) => episode.status === "available" || episode.status === "upcoming") ? "available" : "missing";
}

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = memoizeByFileMtimes("interface-library-status", libraryFilePaths(), () => ({
      movies: loadMovies().map((movie) => ({
        tmdbId: movie.tmdbId,
        status: movie.activeInfoHash ? "downloading" : movie.status,
      })),
      series: loadSeries().map((series) => ({ tmdbId: series.tmdbId, status: seriesStatus(series) })),
    }));
  return NextResponse.json(
    payload,
    { headers: { "Cache-Control": "private, no-cache" } },
  );
}
