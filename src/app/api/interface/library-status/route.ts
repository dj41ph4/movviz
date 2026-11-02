import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { libraryFilePaths, loadMovies, loadSeries } from "@/lib/library/store";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { seriesLibraryStatus } from "@/lib/library/seriesLibraryStatus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = memoizeByFileMtimes("interface-library-status", libraryFilePaths(), () => ({
      movies: loadMovies().map((movie) => ({
        id: movie.id,
        tmdbId: movie.tmdbId,
        status: movie.activeInfoHash ? "downloading" : movie.status,
        hasFile: !!movie.file,
        plexRatingKey: movie.plexRatingKey,
      })),
      series: loadSeries().map((series) => ({ tmdbId: series.tmdbId, status: seriesLibraryStatus(series) })),
    }));
  const machineIdentifier = loadPlexConfig().machineIdentifier;
  return NextResponse.json(
    { ...payload, movies: payload.movies.map((movie) => ({
      ...movie,
      plexUrl: movie.plexRatingKey && machineIdentifier ? buildPlexWebUrl(machineIdentifier, movie.plexRatingKey) : null,
    })) },
    { headers: { "Cache-Control": "private, no-cache" } },
  );
}
