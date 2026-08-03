import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";

export interface HashIndexEntry {
  movie?: LibraryMovie;
  seriesMatch?: { series: LibrarySeries; season: number; episode: number; count: number; matchedSeasonCount?: number };
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
    for (const season of s.seasons) {
      for (const ep of season.episodes) {
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
      // A pack spanning more than one season is a series/multi-season grab
      // regardless of whether it happens to cover literally every monitored
      // episode in the whole show — a show with one season already available
      // elsewhere (different hash) previously made an otherwise-complete pack
      // look "incomplete" and fall back to labeling it after its first
      // episode's season (e.g. "Saison 1" for what was actually most of an
      // intégrale). Single-season packs are unaffected — same season for
      // every match, so this still resolves to that season number.
      const matchedSeasons = new Set(matches.map((m) => m.season));
      const isMultiSeason = matchedSeasons.size > 1;
      byHash.set(hash, {
        seriesMatch: {
          series: s,
          season: isMultiSeason ? 0 : matches[0].season,
          episode: isMultiSeason ? 0 : matches[0].episode,
          count: matches.length,
          matchedSeasonCount: isMultiSeason ? matchedSeasons.size : undefined,
        },
      });
    }
  }
  return { byHash, moviesById, seriesById };
}
