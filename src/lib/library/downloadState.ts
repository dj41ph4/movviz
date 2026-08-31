import path from "node:path";
import { engineGet } from "@/lib/engine/server";
import {
  getMovieByActiveHash,
  loadMovies,
  loadSeries,
  updateMovie,
  updateSeries,
} from "@/lib/library/store";
import type { LibrarySeries, LibraryEpisode, LibraryFile, LibraryStatus } from "@/lib/library/types";
import { notifySeerrStatus } from "@/lib/seerr/mediaMap";
import { parseRelease } from "@/lib/naming/parser";
import { applyImportedFiles, type ImportedFile } from "@/lib/library/applyImportedFiles";
import { withKeyLock } from "@/lib/library/locks";

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
    const newStatus = movie.file ? "available" : "missing";
    updateMovie(movie.id, { status: newStatus, activeInfoHash: null });
    if (newStatus === "available") {
      void notifySeerrStatus("movie", movie.tmdbId, "available").catch(() => {});
    }
  }

  // Release ALL series episodes with this hash in a single pass per series
  // (avoids N disk writes for a season pack with N episodes)
  for (const series of loadSeries()) {
    let seriesChanged = false;
    const newSeasons = series.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((ep) => {
        if (ep.activeInfoHash === infoHash && ep.status !== "available") {
          const ns = releasedStatus(ep.file);
          if (ns.status === "available") {
            seriesChanged = true;
          }
          return { ...ep, ...ns, activeInfoHash: null };
        }
        return ep;
      }),
    }));
    const changed = newSeasons.some((s, i) => {
      const orig = series.seasons[i];
      return s.episodes.some((ep, j) => ep !== orig.episodes[j]);
    });
    if (changed) {
      updateSeries(series.id, { seasons: newSeasons });
    }
    if (seriesChanged) {
      void notifySeerrStatus("series", series.tmdbId, "available").catch(() => {});
    }
  }
}

/**
 * Safety net for every path that doesn't go through the delete endpoint:
 * compares each "downloading" item's claimed torrent against what the engine
 * actually has, and releases the ones whose torrent is gone or no longer
 * actively downloading. Skips entirely when the engine is unreachable.
 */
/** Builds an ImportedFile by parsing the moved file's own name — same
 *  fallback pattern recoverDownloads.ts uses for orphaned files. */
function importedFileFromMovedPath(movedTo: string, size: number): ImportedFile {
  const parsed = parseRelease(path.basename(movedTo));
  return {
    path: movedTo,
    quality: null,
    resolution: parsed.resolution,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    hdr: parsed.hdr,
    source: parsed.source,
    size,
    season: parsed.season,
    episode: parsed.episode,
    episodeEnd: parsed.episodeEnd,
  };
}

export async function reconcileDownloadingItems(): Promise<{ released: number }> {
  const data = await engineGet<{ torrents: { infoHash: string; state: string; movedTo?: string; length?: number }[] }>("torrents");
  if (!data) return { released: 0 };

  // A torrent that exists but is completed/seeding/paused/stalled is NOT
  // actively downloading — the import callback should have fired already,
  // but if it failed the episode stays stuck forever. "blocked" (2 min sans
  // mouvement, règle produit) is still a live torrent that can recover —
  // it stays claimed so the library badge isn't falsely released.
  const ACTIVE_STATES = new Set(["downloading", "metadata", "queued", "blocked"]);
  const torrentsByHash = new Map(data.torrents.map((t) => [t.infoHash, t]));
  const isActivelyDownloading = (infoHash: string) => ACTIVE_STATES.has(torrentsByHash.get(infoHash)?.state ?? "");

  let released = 0;
  for (const movie of loadMovies()) {
    if (movie.status === "downloading" && movie.activeInfoHash) {
      const infoHash = movie.activeInfoHash;
      const t = torrentsByHash.get(infoHash);
      if (!isActivelyDownloading(infoHash)) {
        // The file already sits on disk at its final library path (import
        // succeeded engine-side) but the library never recorded it — a
        // concurrent import write for another title/episode raced this one
        // and clobbered it (see locks.ts). Adopt the file instead of
        // discarding it and forcing a wasted re-download.
        if (t?.movedTo) {
          await applyImportedFiles({ kind: "movie", movieId: movie.id }, [importedFileFromMovedPath(t.movedTo, t.length ?? 0)], infoHash);
        } else {
          // Same lock gap as the episode fallback below — updateMovie() is
          // the same unlocked read-modify-write against the movies list.
          const newStatus = movie.file ? "available" : "missing";
          await withKeyLock(`movie:${movie.id}`, async () => {
            updateMovie(movie.id, { status: newStatus, activeInfoHash: null });
          });
          if (newStatus === "available") {
            void notifySeerrStatus("movie", movie.tmdbId, "available").catch(() => {});
          }
        }
        released++;
      }
    }
  }
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.status === "downloading" && ep.activeInfoHash) {
          const infoHash = ep.activeInfoHash;
          const t = torrentsByHash.get(infoHash);
          if (!isActivelyDownloading(infoHash)) {
            if (t?.movedTo) {
              await applyImportedFiles(
                { kind: "episode", seriesId: series.id, season: season.seasonNumber, episode: ep.episodeNumber },
                [importedFileFromMovedPath(t.movedTo, t.length ?? 0)],
                infoHash
              );
            } else {
              // Bug fix: this fallback wrote via updateSeries() with no lock,
              // unlike every other read-modify-write against a series (see
              // locks.ts's own comment — several episodes racing here is
              // exactly the "most 'available' flips silently lost" bug it
              // exists to prevent). The read now happens INSIDE the lock too,
              // not before it, so it can't observe a stale snapshot from
              // before a concurrent writer's turn.
              await withKeyLock(`series:${series.id}`, async () => {
                const current = loadSeries().find((s) => s.id === series.id);
                if (current) patchEpisode(current, season.seasonNumber, ep.episodeNumber, { status: ep.file ? "available" : "missing", activeInfoHash: null });
              });
            }
            released++;
          }
        }
      }
    }
  }
  return { released };
}
