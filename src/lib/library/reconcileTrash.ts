import { loadMovies, loadSeries, updateMovie, removeMovie, updateSeries, removeSeries, clearEpisodeFile } from "@/lib/library/store";
import { addToTrash } from "@/lib/library/trashStore";
import { pathFor } from "@/lib/library/renamePath";
import type { RescanIssue } from "@/lib/library/reconcile";

/**
 * Turns reconcileLibrary()'s "missing" issues into actual trash entries —
 * the piece that was missing (heh) before this feature: reconcileLibrary()
 * itself stays 100% read-only (shared with the manual admin "Reconcile"
 * button, which should only ever report, never act as a side effect of a
 * diagnostic click). Only the scheduled `library-reconcile` task calls this.
 *
 * Only acts on a title that was genuinely `"available"` — a file confirmed
 * present at some point and now confirmed gone from disk (reconcileLibrary
 * already verified this against the engine's own completedPath roots, which
 * is a stronger signal than Plex simply not reporting an item — see
 * markMissingFromPlex's own comment on why it deliberately never removes a
 * record on that weaker signal alone). A movie/episode that was already
 * "missing"/"searching"/"upcoming" is left untouched — there's nothing to
 * trash, it was never confirmed available in the first place.
 */
export function applyMissingFileTrash(issues: RescanIssue[]): { movies: number; episodes: number; series: number } {
  const missingPaths = new Set(issues.filter((i) => i.kind === "missing").map((i) => i.path));
  if (missingPaths.size === 0) return { movies: 0, episodes: 0, series: 0 };

  let movies = 0;
  for (const movie of loadMovies()) {
    if (movie.status !== "available" || !movie.file) continue;
    const normalized = pathFor(movie.file.path).normalize(movie.file.path);
    if (!missingPaths.has(normalized)) continue;
    updateMovie(movie.id, { status: "missing", file: null, activeInfoHash: null, plexRatingKey: null, plexMediaInfo: null });
    removeMovie(movie.id, "externalDeletion");
    movies++;
  }

  let episodes = 0;
  let seriesCount = 0;
  for (const series of loadSeries()) {
    const matched: { season: number; episode: number }[] = [];
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.status !== "available" || !ep.file) continue;
        const normalized = pathFor(ep.file.path).normalize(ep.file.path);
        if (missingPaths.has(normalized)) matched.push({ season: season.seasonNumber, episode: ep.episodeNumber });
      }
    }
    if (matched.length === 0) continue;

    // If this pass wipes out every episode this series ever had available,
    // one grouped "series" trash entry is much less clutter than N separate
    // "episode" entries — same guarantee either way (nothing re-downloads,
    // everything restorable), just a cleaner corbeille for a friend who
    // deleted a whole show at once instead of one file.
    const isMatched = (s: number, e: number) => matched.some((m) => m.season === s && m.episode === e);
    const anyStillAvailable = series.seasons.some((season) =>
      season.episodes.some((ep) => ep.status === "available" && !isMatched(season.seasonNumber, ep.episodeNumber))
    );

    if (!anyStillAvailable) {
      const correctedSeasons = series.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((ep) =>
          isMatched(season.seasonNumber, ep.episodeNumber)
            ? { ...ep, status: "missing" as const, file: null, activeInfoHash: null }
            : ep
        ),
      }));
      updateSeries(series.id, { seasons: correctedSeasons });
      removeSeries(series.id, "externalDeletion");
      seriesCount++;
      continue;
    }

    for (const { season, episode } of matched) {
      const seasonObj = series.seasons.find((s) => s.seasonNumber === season)!;
      const ep = seasonObj.episodes.find((e) => e.episodeNumber === episode)!;
      // Snapshot before clearing — carries the episode's own plexRatingKey,
      // used later if the user permanently deletes this trash entry.
      addToTrash({
        id: `episode_${series.tmdbId}_${season}_${episode}`,
        tmdbId: series.tmdbId,
        type: "episode",
        title: `${series.title} — S${season}E${episode}`,
        posterPath: series.posterPath,
        backdropPath: series.backdropPath,
        year: series.year,
        rating: series.rating,
        overview: series.overview,
        snapshot: ep,
        seriesTmdbId: series.tmdbId,
        seasonNumber: season,
        episodeNumber: episode,
        origin: "externalDeletion",
        deletedAt: Date.now(),
      });
      clearEpisodeFile(series.id, season, episode);
      episodes++;
    }
  }

  return { movies, episodes, series: seriesCount };
}
