import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import type { DashboardWidgetId } from "@/lib/dashboard/types";
import type { DashboardFileTechnical, DashboardInterfaceData } from "@/lib/dashboard/interfaceTypes";
import { libraryFilePaths, loadMovies, loadSeries } from "@/lib/library/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";

export const dynamic = "force-dynamic";

function technical(file: { resolution: string | null; videoCodec: string | null; audioCodec: string | null; hdr: string | null } | null): DashboardFileTechnical | null {
  if (!file) return null;
  return {
    resolution: file.resolution,
    videoCodec: file.videoCodec,
    audioCodec: file.audioCodec,
    hdr: file.hdr,
  };
}

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cfg = loadPlexConfig();
  const payload = memoizeByFileMtimes<DashboardInterfaceData>(
    `interface-dashboard:${cfg.machineIdentifier ?? "none"}`,
    libraryFilePaths(),
    () => {
      const movies = loadMovies();
      const series = loadSeries();

      let episodes = 0;
      let missingEpisodes = 0;
      let availableEpisodes = 0;
      let downloadingEpisodes = 0;
      let searchingEpisodes = 0;
      const compactSeries = series.map((show) => {
        let hasAvailableEpisode = false;
        for (const season of show.seasons) {
          for (const episode of season.episodes) {
            if (!episode.monitored) continue;
            episodes++;
            if (episode.status === "available") {
              availableEpisodes++;
              hasAvailableEpisode = true;
            } else if (episode.status === "downloading") downloadingEpisodes++;
            else if (episode.status === "searching") searchingEpisodes++;
            else if (episode.status === "missing") missingEpisodes++;
          }
        }
        return {
          id: show.id,
          tmdbId: show.tmdbId,
          title: show.title,
          year: show.year,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          customBackdropPath: show.customBackdropPath ?? null,
          customLogoPath: show.customLogoPath ?? null,
          rating: show.rating,
          genres: show.genres,
          addedAt: show.addedAt,
          hasAvailableEpisode,
        };
      });

      const compactMovies = movies.map((movie) => ({
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        releaseDate: movie.releaseDate,
        vfReleaseDate: movie.vfReleaseDate,
        posterPath: movie.posterPath,
        backdropPath: movie.backdropPath,
        customBackdropPath: movie.customBackdropPath ?? null,
        customLogoPath: movie.customLogoPath ?? null,
        rating: movie.rating,
        runtime: movie.runtime,
        genres: movie.genres,
        status: movie.status,
        file: technical(movie.file),
        activeInfoHash: movie.activeInfoHash,
        addedAt: movie.addedAt,
        plexRatingKey: movie.plexRatingKey,
        plexUrl: movie.plexRatingKey && cfg.machineIdentifier
          ? buildPlexWebUrl(cfg.machineIdentifier, movie.plexRatingKey)
          : null,
      }));

      const widgetValues: Record<DashboardWidgetId, number> = {
        movies: movies.length,
        series: series.length,
        episodes,
        missingEpisodes,
        available: movies.filter((movie) => movie.status === "available").length + availableEpisodes,
        downloading: movies.filter((movie) => movie.status === "downloading").length + downloadingEpisodes,
        searching: movies.filter((movie) => movie.status === "searching").length + searchingEpisodes,
        missing: movies.filter((movie) => movie.status === "missing").length,
        episodesAvailable: availableEpisodes,
      };

      return {
        movies: compactMovies,
        series: compactSeries,
        widgetValues,
        compactRecentMovies: [...movies].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12),
      };
    },
  );
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-cache" } });
}
