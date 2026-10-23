import { recentEpisodePage } from "@/lib/library/recentEpisodes";
import { compressedJson } from "@/lib/http/compressedJson";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import type { DashboardWidgetId } from "@/lib/dashboard/types";
import type { DashboardFileTechnical, DashboardInterfaceData, DashboardRecentEpisode } from "@/lib/dashboard/interfaceTypes";
import { libraryFilePaths, loadMovies, loadSeries } from "@/lib/library/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";
import { buildRewatchRow } from "@/lib/dashboard/rewatch";

export const dynamic = "force-dynamic";

function recentEpisodeCandidates(series: ReturnType<typeof loadSeries>, machineIdentifier: string | null | undefined): DashboardRecentEpisode[] {
  return series.flatMap((show) => show.seasons.flatMap((season) => season.episodes
    .filter((episode) => episode.status === "available" && episode.file)
    .map((episode) => ({
      seriesId: show.id,
      tmdbId: show.tmdbId,
      title: show.title,
      year: show.year,
      posterPath: show.posterPath,
      backdropPath: show.backdropPath,
      customBackdropPath: show.customBackdropPath ?? null,
      customLogoPath: show.customLogoPath ?? null,
      rating: show.rating,
      genres: show.genres,
      seasonNumber: season.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      addedAt: episode.file!.addedAt,
      plexRatingKey: episode.plexRatingKey,
      plexUrl: episode.plexRatingKey && machineIdentifier
        ? buildPlexWebUrl(machineIdentifier, episode.plexRatingKey)
        : null,
      file: technical(episode.file),
    }))));
}

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
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cfg = loadPlexConfig();
  const onlyRecent = req.nextUrl.searchParams.get("only") === "recent";
  const cursor = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("cursor") ?? "0", 10) || 0);
  if (onlyRecent) {
    const page = memoizeByFileMtimes(
      `interface-recent:${cfg.machineIdentifier ?? "none"}:${cursor}`,
      libraryFilePaths(),
      () => recentEpisodePage(recentEpisodeCandidates(loadSeries(), cfg.machineIdentifier), cursor),
    );
    return compressedJson(req, { recentEpisodes: page.episodes, recentEpisodesNextCursor: page.nextCursor }, { headers: { "Cache-Control": "private, no-cache" } });
  }
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
        // Available episodes per season, so clients can show a season's
        // unwatched count without loading the full season tree.
        const availableBySeason: Record<number, number> = {};
        for (const season of show.seasons) {
          for (const episode of season.episodes) {
            if (!episode.monitored) continue;
            episodes++;
            if (episode.status === "available") {
              availableEpisodes++;
              hasAvailableEpisode = true;
              availableBySeason[season.seasonNumber] = (availableBySeason[season.seasonNumber] ?? 0) + 1;
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
          availableBySeason,
        };
      });

      // Files belong to the library, independently of the download queue.
      // Page by series so a bulk import cannot hide all other arrivals.
      const recentPage = recentEpisodePage(recentEpisodeCandidates(series, cfg.machineIdentifier));

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
        tmdbCollectionId: movie.tmdbCollectionId ?? null,
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
        recentEpisodes: recentPage.episodes,
        recentEpisodesNextCursor: recentPage.nextCursor,
      };
    },
  );
  // « À revoir » dépend de l'utilisateur : calculé à chaque requête, hors
  // du cache partagé ci-dessus (données locales seulement, aucun appel TMDb).
  return compressedJson(req, { ...payload, rewatch: buildRewatchRow(user.id) }, { headers: { "Cache-Control": "private, no-cache" } });
}
