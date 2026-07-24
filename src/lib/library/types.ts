/**
 * Movviz library — the persistent record of what's monitored and what's
 * actually on disk. This is the piece that ties discovery (TMDb), search
 * (indexers), and the download engine into one coherent lifecycle: add a
 * title → it gets searched → a release is grabbed → the engine renames it →
 * the library entry flips to "available" with the real file path.
 */

export type LibraryStatus = "missing" | "searching" | "downloading" | "available";

import type { PlexMediaInfo } from "@/lib/plex/types";

export interface QualityProfile {
  id: string;
  name: string;
  /** Ordered worst→best; only these are accepted. */
  allowedResolutions: string[]; // e.g. ["720p","1080p","2160p"]
  /** Minimum score (see naming parser's score()) to accept a release at all. */
  minScore: number;
  /** Once a file at/above this resolution is owned, stop upgrading. */
  cutoffResolution: string;
}

export interface LibraryFile {
  path: string;
  /** Chemin réel sur le disque local (scan disque), utilisé par rename/naming. distinct de path (Plex/engine). */
  diskPath?: string;
  quality: string; // e.g. "BluRay 1080p"
  resolution: string | null;
  videoCodec: string | null; // e.g. "x265"
  audioCodec: string | null; // e.g. "DTS", "DDP5.1"
  hdr: string | null;        // e.g. "HDR10", "Dolby Vision"
  source: string | null;     // e.g. "BluRay", "WEB-DL"
  size: number; // bytes
  addedAt: number;
}

export interface LibraryMovie {
  id: string; // movviz id, "mv_..."
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  releaseDate: string | null;
  vfReleaseDate: string | null; // France digital/physical release date — when it's actually obtainable
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  runtime: number | null;
  genres: string[];
  monitored: boolean;
  qualityProfileId: string;
  status: LibraryStatus;
  file: LibraryFile | null;
  /** infoHash of the torrent currently in flight for this movie, if any. */
  activeInfoHash: string | null;
  addedAt: number;
  tags: string[];
  /** Plex library item id — set by the Plex library sync, powers "Watch on Plex". */
  plexRatingKey: string | null;
  /** Rich media metadata from Plex (streams, chapters, container, bitrate). */
  plexMediaInfo: PlexMediaInfo | null;
  /**
   * TMDb franchise id (belongs_to_collection), null if this movie isn't part
   * of one, undefined if never checked yet (movies added before this field
   * existed — backfilled by the "scan for sagas" pass instead of on every read).
   */
  tmdbCollectionId?: number | null;
}

export interface LibraryEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
  monitored: boolean;
  status: LibraryStatus;
  file: LibraryFile | null;
  activeInfoHash: string | null;
  /** Plex library item id for this exact episode — set by the Plex library sync, powers "Watch on Plex". */
  plexRatingKey: string | null;
}

export interface LibrarySeason {
  seasonNumber: number;
  name: string;
  monitored: boolean;
  episodes: LibraryEpisode[];
}

export interface LibrarySeries {
  id: string; // "sr_..."
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  genres: string[];
  tvStatus: string;
  monitored: boolean;
  qualityProfileId: string;
  seasons: LibrarySeason[];
  addedAt: number;
  tags: string[];
  /** Plex library item id (the show) — set by the Plex library sync, powers "Watch on Plex". */
  plexRatingKey: string | null;
}

/**
 * Reference embedded in an engine grab so the completion callback knows which
 * library entry to update. Encoded as a compact string on the wire.
 */
export type LibraryRef =
  | { kind: "movie"; movieId: string }
  | { kind: "episode"; seriesId: string; season: number; episode: number }
  | { kind: "season"; seriesId: string; season: number }
  | { kind: "series"; seriesId: string };

export function encodeLibraryRef(ref: LibraryRef): string {
  if (ref.kind === "movie") return `movie:${ref.movieId}`;
  if (ref.kind === "season") return `season:${ref.seriesId}:${ref.season}`;
  if (ref.kind === "series") return `series:${ref.seriesId}`;
  return `episode:${ref.seriesId}:${ref.season}:${ref.episode}`;
}

export function decodeLibraryRef(s: string): LibraryRef | null {
  const parts = s.split(":");
  if (parts[0] === "movie" && parts[1]) return { kind: "movie", movieId: parts[1] };
  if (parts[0] === "season" && parts.length === 3) {
    return { kind: "season", seriesId: parts[1], season: Number(parts[2]) };
  }
  if (parts[0] === "episode" && parts.length === 4) {
    return {
      kind: "episode",
      seriesId: parts[1],
      season: Number(parts[2]),
      episode: Number(parts[3]),
    };
  }
  if (parts[0] === "series" && parts[1]) return { kind: "series", seriesId: parts[1] };
  return null;
}

/** Tags a user can attach to any library item for personal organization. */
export interface Taggable {
  tags: string[];
}
