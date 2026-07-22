import { engineGet } from "@/lib/engine/server";
import {
  getMovieByActiveHash,
  loadMovies,
  loadSeries,
  updateMovie,
  updateSeries,
} from "@/lib/library/store";
import type { LibrarySeries, LibraryEpisode, LibraryFile, LibraryStatus } from "@/lib/library/types";

/**
 * Keeps library "downloading" badges honest. A movie/episode flips to
 * "downloading" the moment a torrent is grabbed and only flips again when the
 * import completes — so if the torrent disappears in between (deleted from the
 * Downloads page, engine wiped, crash before resume data was written), the
 * item would wear a "downloading" badge forever for a download that no longer
 * exists. These two entry points put it back to "missing" so it becomes
 * visible to the wanted list / RSS scan again.
 */

function patchEpisode(series: LibrarySeries, seasonNumber: number, episodeNumber: number, patch: Partial<LibraryEpisode>) {
  const seasons = series.seasons.map((s) =>
    s.seasonNumber !== seasonNumber
      ? s
      : { ...s, episodes: s.episodes.map((e) => (e.episodeNumber === episodeNumber ? { ...e, ...patch } : e)) }
  );
  updateSeries(series.id, { seasons });
}

function releasedStatus(file: LibraryFile | null): { status: LibraryStatus } {
  return { status: file ? "available" : "missing" };
}

/**
 * Releases ALL library items (movie + every series episode) that were waiting
 * on a given infoHash. This handles season packs and complete-series packs
 * where multiple episodes share the same activeInfoHash — the old code only
 * released the first match, leaving the rest stuck on "downloading" forever.
 */
export function releaseAllDownloadClaims(infoHash: string) {
  // Release movie
  const movie = getMovieByActiveHash(infoHash);
  if (movie && movie.status !== "available") {
    updateMovie(movie.id, { ...releasedStatus(movie.file), activeInfoHash: null });
  }

  // Release ALL series episodes with this hash in a single pass per series
  // (avoids N disk writes for a season pack with N episodes)
  for (const series of loadSeries()) {
    const newSeasons = series.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((ep) =>
        ep.activeInfoHash === infoHash && ep.status !== "available"
          ? { ...ep, ...releasedStatus(ep.file), activeInfoHash: null }
          : ep
      ),
    }));
    // Only write back if something actually changed
    const changed = newSeasons.some((s, i) => {
      const orig = series.seasons[i];
      return s.episodes.some((ep, j) => ep !== orig.episodes[j]);
    });
    if (changed) {
      updateSeries(series.id, { seasons: newSeasons });
    }
  }
}

/**
 * Safety net for every path that doesn't go through the delete endpoint:
 * compares each "downloading" item's claimed torrent against what the engine
 * actually has, and releases the ones whose torrent is gone or no longer
 * actively downloading. Skips entirely when the engine is unreachable.
 */
export async function reconcileDownloadingItems(): Promise<{ released: number }> {
  const data = await engineGet<{ torrents: { infoHash: string; state: string }[] }>("torrents");
  if (!data) return { released: 0 };

  // A torrent that exists but is completed/seeding/paused/stalled is NOT
  // actively downloading — the import callback should have fired already,
  // but if it failed the episode stays stuck forever. Only "downloading",
  // "metadata", and "queued" count as truly active.
  const ACTIVE_STATES = new Set(["downloading", "metadata", "queued"]);
  const isActivelyDownloading = new Map(data.torrents.map((t) => [t.infoHash, ACTIVE_STATES.has(t.state)]));

  let released = 0;
  for (const movie of loadMovies()) {
    if (movie.status === "downloading" && movie.activeInfoHash) {
      const active = isActivelyDownloading.get(movie.activeInfoHash);
      if (active === false || active === undefined) {
        updateMovie(movie.id, { status: movie.file ? "available" : "missing", activeInfoHash: null });
        released++;
      }
    }
  }
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.status === "downloading" && ep.activeInfoHash) {
          const active = isActivelyDownloading.get(ep.activeInfoHash);
          if (active === false || active === undefined) {
            const current = loadSeries().find((s) => s.id === series.id);
            if (current) patchEpisode(current, season.seasonNumber, ep.episodeNumber, { status: ep.file ? "available" : "missing", activeInfoHash: null });
            released++;
          }
        }
      }
    }
  }
  return { released };
}
