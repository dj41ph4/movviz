import path from "node:path";
import { loadMovies, loadSeries, libraryFilePaths } from "@/lib/library/store";
import { memoizeByFileMtimes, memoCache } from "@/lib/fsJsonCache";
import { parseRelease } from "@/lib/naming/parser";
import { normalizeCodec } from "@/lib/library/releaseRules";
import { applyCustomFormats } from "@/lib/indexers/torznab";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";

/**
 * Flat, pre-parsed snapshot of every movie + episode in the library — built
 * once and memoized until library.json files change (mtime/size). Eliminates
 * the per-movie/per-episode parseRelease() + applyCustomFormats() work that
 * findUpgradeCandidates() used to do on every single poll.
 */

export interface MediaIndexEntry {
  /** "movie" or "episode" */
  kind: "movie" | "episode";
  movieId?: string;
  seriesId?: string;
  title: string;
  year: number | null;
  season?: number;
  episode?: number;
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  language: string | null;
  hdr: string | null;
  size: number;
  formatScore: number;
  qualityProfileId: string;
  monitored: boolean;
  status: string;
}

export interface MediaIndex {
  movies: MediaIndexEntry[];
  episodes: MediaIndexEntry[];
  computedAt: number;
}

function buildMediaIndex(): MediaIndex {
  const movies: MediaIndexEntry[] = [];
  for (const m of loadMovies()) {
    if (m.status !== "available" || !m.file) continue;
    const basename = path.basename(m.file.path);
    const parsed = parseRelease(basename);
    movies.push({
      kind: "movie",
      movieId: m.id,
      title: m.title,
      year: m.year,
      resolution: m.file.resolution ?? parsed.resolution,
      videoCodec: m.file.videoCodec ?? parsed.videoCodec,
      audioCodec: m.file.audioCodec ?? parsed.audioCodec,
      language: m.file.language ?? parsed.language,
      hdr: m.file.hdr ?? parsed.hdr,
      size: m.file.size,
      formatScore: applyCustomFormats(basename),
      qualityProfileId: m.qualityProfileId,
      monitored: m.monitored,
      status: m.status,
    });
  }

  const episodes: MediaIndexEntry[] = [];
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.status !== "available" || !ep.file) continue;
        const basename = path.basename(ep.file.path);
        const parsed = parseRelease(basename);
        episodes.push({
          kind: "episode",
          seriesId: series.id,
          title: series.title,
          year: series.year,
          season: season.seasonNumber,
          episode: ep.episodeNumber,
          resolution: ep.file.resolution ?? parsed.resolution,
          videoCodec: ep.file.videoCodec ?? parsed.videoCodec,
          audioCodec: ep.file.audioCodec ?? parsed.audioCodec,
          language: ep.file.language ?? parsed.language,
          hdr: ep.file.hdr ?? parsed.hdr,
          size: ep.file.size,
          formatScore: 0,
          qualityProfileId: series.qualityProfileId,
          monitored: ep.monitored,
          status: ep.status,
        });
      }
    }
  }

  return { movies, episodes, computedAt: Date.now() };
}

let _computedVersion = "";

export function getMediaIndex(): MediaIndex {
  const result = memoizeByFileMtimes("media-index", libraryFilePaths(), buildMediaIndex);
  // Exposed for diagnostics — detect stale cache without recomputing.
  _computedVersion = `${result.computedAt}`;
  return result;
}

/** Force-rebuild on next call — useful after a direct library write outside the store. */
export function invalidateMediaIndex(): void {
  memoCache.delete("media-index");
}
