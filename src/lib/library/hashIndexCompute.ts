import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";

export interface HashIndexEntry {
  movie?: LibraryMovie;
  seriesMatch?: { series: LibrarySeries; season: number; episode: number; count: number };
}

export interface HashIndexResult {
  byHash: Map<string, HashIndexEntry>;
  moviesById: Map<string, LibraryMovie>;
  seriesById: Map<string, LibrarySeries>;
}

/**
 * Pure reduction over already-loaded library arrays — no I/O, no memoization.
 * Exists as its own module so the exact same logic can run either inline on
 * the main thread (fallback if the worker pool is unavailable) or be
 * duplicated in workers/hashIndexWorker.mjs, a plain Node script that runs
 * outside Next.js's bundler/path-alias resolution and therefore can't import
 * this module directly — see that file's header comment. Keep both in sync
 * if this logic ever changes.
 *
 * A season pack shares one activeInfoHash across several episodes — every
 * one of them is collected so the queue can say "season pack, N episodes"
 * instead of silently picking the first and looking stuck on one episode.
 */
export function computeHashIndex(movies: LibraryMovie[], series: LibrarySeries[]): HashIndexResult {
  const byHash = new Map<string, HashIndexEntry>();
  const moviesById = new Map<string, LibraryMovie>();
  const seriesById = new Map<string, LibrarySeries>();
  for (const movie of movies) {
    moviesById.set(movie.id, movie);
    if (movie.activeInfoHash) byHash.set(movie.activeInfoHash, { movie });
  }
  for (const s of series) {
    seriesById.set(s.id, s);
    const matchesByHash = new Map<string, { season: number; episode: number }[]>();
    let totalMonitored = 0;
    for (const season of s.seasons) {
      for (const ep of season.episodes) {
        if (ep.monitored) totalMonitored++;
        if (ep.activeInfoHash) {
          const list = matchesByHash.get(ep.activeInfoHash) ?? [];
          list.push({ season: season.seasonNumber, episode: ep.episodeNumber });
          matchesByHash.set(ep.activeInfoHash, list);
        }
      }
    }
    for (const [hash, matches] of matchesByHash) {
      // A movie owning the same hash keeps priority — same precedence as
      // the old sequential scan (movie checked first).
      if (byHash.has(hash)) continue;
      const isComplete = totalMonitored > 0 && matches.length >= totalMonitored;
      byHash.set(hash, {
        seriesMatch: {
          series: s,
          season: isComplete ? 0 : matches[0].season,
          episode: isComplete ? 0 : matches[0].episode,
          count: matches.length,
        },
      });
    }
  }
  return { byHash, moviesById, seriesById };
}
