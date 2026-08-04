/**
 * Movviz library — the persistent record of what's monitored and what's
 * actually on disk. This is the piece that ties discovery (TMDb), search
 * (indexers), and the download engine into one coherent lifecycle: add a
 * title → it gets searched → a release is grabbed → the engine renames it →
 * the library entry flips to "available" with the real file path.
 */

/**
 * "upcoming" — release date is in the future (or unknown-but-unaired for an
 * episode): deliberately excluded from every search path (searchAllMissing,
 * the 6h retry task, RSS matching) so the engine never wastes indexer calls
 * on something that can't possibly exist yet. A scheduled task flips it to
 * "missing" once the date passes, at which point the normal search pipeline
 * picks it up like anything else.
 */
export type LibraryStatus = "upcoming" | "missing" | "searching" | "downloading" | "available";

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
  /** Langue détectée (Plex audio streams > filename tags). */
  language?: string | null;
}

/**
 * Why a grab happened — threaded through the existing/new grab paths into
 * `decisionLog.ts`, NOT a second engine: `first_acquisition` is the normal
 * `autoGrab.ts` path (unchanged), `quality_upgrade` is the existing
 * `searchAndReplace.ts` path (unchanged), `additional_version` is the new
 * LOT6 "add a version" search (`addVersionSearch.ts`) which deliberately
 * ignores quality/size limits but keeps every safety filter.
 */
export type GrabIntent = "first_acquisition" | "quality_upgrade" | "additional_version";

/**
 * One physical file for a movie that can have several. `primary: boolean`
 * lives per-entry rather than as a separate index into the array — adding
 * or removing a version never requires shifting an index alongside it.
 * Deliberately shaped as `LibraryFile` + a few fields so `versions.ts` can
 * operate on it generically (see LOT8 — same shape will back episodes
 * later without a rewrite).
 */
export interface LibraryFileVersion extends LibraryFile {
  id: string;
  /**
   * Indexer name, or "plex" when detected via the Plex library sync. Named
   * `versionSource` (not `source`) because `LibraryFile` already has a
   * `source` field with a different meaning (release source, e.g. "BluRay").
   */
  versionSource: string;
  /** Human-readable — "Acquisition initiale", "Version supplémentaire", or free text. */
  reason: string;
  primary: boolean;
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
  /**
   * Additional copies of this same movie (e.g. a 2160p HDR primary + a 1080p
   * VF secondary) — absent/empty for the overwhelming majority of
   * single-file movies. `file` always stays populated as a mirror of
   * whichever entry has `primary: true`, so the ~20 existing call sites
   * that read `movie.file` directly need zero changes. Only code that
   * ADDS/replaces a version goes through `src/lib/library/versions.ts`
   * instead of patching `file` by hand.
   */
  versions?: LibraryFileVersion[];
  /** infoHash of the torrent currently in flight for this movie, if any. */
  activeInfoHash: string | null;
  addedAt: number;
  tags: string[];
  /**
   * Admin-supplied alternate names for this title (e.g. the romanized
   * original-language title). Only used by release matching, to accept
   * releases that glue an alias onto the official title — never displayed.
   * Optional: undefined means "none", so existing entries need no backfill.
   */
  aliases?: string[];
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
  /**
   * TMDb's original (non-localized) title — e.g. "Law and Order: Organized
   * Crime" for a movie whose French `title` is completely different. Needed
   * because a scene release is always named after the original title, never
   * the localized one: any matching done purely by filename (recovering an
   * orphaned download with no libraryRef to lean on) has to check both.
   * A normal grab never needs this — it already knows exactly which title
   * it's downloading via libraryRef, so the imported file is renamed using
   * the library's own `title` regardless of what the release was called.
   * `undefined` for entries added before this field existed (backfilled by
   * the TVDB/anime sync-all pass for series; not yet for movies).
   */
  originalTitle?: string | null;
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
  /** See the identical field on LibraryMovie — alternate names used only by release matching. */
  aliases?: string[];
  /** Plex library item id (the show) — set by the Plex library sync, powers "Watch on Plex". */
  plexRatingKey: string | null;
  /** See the identical field on LibraryMovie for why this exists. */
  originalTitle?: string | null;
}

/**
 * A movie mid-download still carries its pre-grab `status` (e.g. "missing")
 * until the engine's completion callback flips it — `activeInfoHash` is the
 * real-time signal that a grab is in flight. Was duplicated ad-hoc at every
 * call site that needed a movie's true current status; one source of truth
 * here instead.
 */
export function resolveMovieStatus(movie: Pick<LibraryMovie, "status" | "activeInfoHash">): LibraryStatus {
  return movie.activeInfoHash ? "downloading" : movie.status;
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
