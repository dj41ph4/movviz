/**
 * Phase 2 — bulk probe entry point (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §8: "à l'import ou à la découverte d'un nouveau fichier"). Walks every
 * owned movie with a local file and warms the MediaDescriptor cache for it,
 * so later playback decisions never pay ffprobe's cost. Triggered from
 * Réglages > Maintenance (MediaProbePanel.tsx) via the shared job queue —
 * see /api/library/media-probe/scan.
 */

import { getMovie, getSeries, loadMovies, loadSeries, updateMovie, updateSeries } from "@/lib/library/store";
import { getPrimaryFile, setPrimaryFile } from "@/lib/library/versions";
import type { LibraryFile } from "@/lib/library/types";
import { getOrProbeMediaDescriptor } from "./mediaProbeCache";
import { fileFieldsFromDescriptor } from "./mediaDescriptorEnrich";
import type { MediaDescriptor } from "./mediaDescriptor";

/**
 * Episodes have no versions[]/multi-version concept (see LibraryEpisode in
 * src/lib/library/types.ts — a bare `file: LibraryFile | null`), so unlike
 * movies there's no shared movie id to key the probe cache on. Build a
 * stable synthetic id instead — collision-free against real movie/series ids
 * (those are prefixed "mv_"/"sr_", this always has a literal ":s"/"e" in it).
 */
function episodeMediaId(seriesId: string, seasonNumber: number, episodeNumber: number): string {
  return `${seriesId}:s${seasonNumber}e${episodeNumber}`;
}

export interface ProbeLibraryResult {
  probed: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * TODO_POST_MOTEUR_LECTURE.md item 3 — after a successful probe, upgrade
 * this movie's displayed quality badges (resolution/videoCodec/audioCodec/
 * hdr) with the more trustworthy ffprobe truth, going through
 * setPrimaryFile() so versions[] stays in sync (never hand-patch `file`
 * directly — see CLAUDE.md's multi-version gotcha). A no-op, on-disk-write
 * wise, when nothing actually changed.
 */
function enrichMovieFromDescriptor(movieId: string, descriptor: MediaDescriptor): void {
  const movie = getMovie(movieId);
  if (!movie) return;
  const current = getPrimaryFile(movie);
  if (!current) return;

  const enriched = fileFieldsFromDescriptor(descriptor);
  const nextFile: LibraryFile = {
    ...current,
    resolution: enriched.resolution ?? current.resolution,
    videoCodec: enriched.videoCodec ?? current.videoCodec,
    audioCodec: enriched.audioCodec ?? current.audioCodec,
    // Not falling back to `current.hdr` here on purpose: "ffprobe found no
    // HDR" is itself a confident, meaningful answer (matches MediaBadges'
    // own "no tag = SDR" convention), so it should correct a wrong existing
    // guess rather than defer to it.
    hdr: enriched.hdr,
  };
  if (
    nextFile.resolution === current.resolution &&
    nextFile.videoCodec === current.videoCodec &&
    nextFile.audioCodec === current.audioCodec &&
    nextFile.hdr === current.hdr
  ) {
    return;
  }

  const updated = setPrimaryFile(movie, nextFile, { versionSource: "ffprobe", reason: "Analyse technique (ffprobe)" });
  updateMovie(movieId, { file: updated.file, versions: updated.versions });
}

/** Episode equivalent of enrichMovieFromDescriptor — same ffprobe-truth-wins
 *  policy on resolution/videoCodec/audioCodec/hdr, but patches `episode.file`
 *  directly (no setPrimaryFile/versions[] — episodes don't have that concept). */
function enrichEpisodeFromDescriptor(seriesId: string, seasonNumber: number, episodeNumber: number, descriptor: MediaDescriptor): void {
  const series = getSeries(seriesId);
  if (!series) return;

  const enriched = fileFieldsFromDescriptor(descriptor);
  let changed = false;
  const seasons = series.seasons.map((season) => {
    if (season.seasonNumber !== seasonNumber) return season;
    const episodes = season.episodes.map((ep) => {
      if (ep.episodeNumber !== episodeNumber || !ep.file) return ep;
      const current = ep.file;
      const nextFile: LibraryFile = {
        ...current,
        resolution: enriched.resolution ?? current.resolution,
        videoCodec: enriched.videoCodec ?? current.videoCodec,
        audioCodec: enriched.audioCodec ?? current.audioCodec,
        hdr: enriched.hdr, // see enrichMovieFromDescriptor's identical comment — ffprobe's "no HDR" is authoritative
      };
      if (
        nextFile.resolution === current.resolution &&
        nextFile.videoCodec === current.videoCodec &&
        nextFile.audioCodec === current.audioCodec &&
        nextFile.hdr === current.hdr
      ) {
        return ep;
      }
      changed = true;
      return { ...ep, file: nextFile };
    });
    return { ...season, episodes };
  });

  if (changed) updateSeries(seriesId, { seasons });
}

export interface ProbeLibrarySeriesResult extends ProbeLibraryResult {
  /** Number of series walked (for progress display — total/probed/skipped/failed above count episodes). */
  seriesCount: number;
}

export async function probeAllLibrarySeries(
  onProgress?: (current: number, total: number) => void,
  opts?: { shouldCancel?: () => boolean; force?: boolean }
): Promise<ProbeLibrarySeriesResult> {
  const allSeries = loadSeries();
  const episodeRefs = allSeries.flatMap((series) =>
    series.seasons.flatMap((season) =>
      season.episodes
        .filter((ep) => ep.file)
        .map((ep) => ({ seriesId: series.id, seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, file: ep.file! }))
    )
  );
  const total = episodeRefs.length;
  let probed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < episodeRefs.length; i++) {
    if (opts?.shouldCancel?.()) break;
    onProgress?.(i, total);

    const ref = episodeRefs[i];
    const filePath = ref.file.diskPath ?? ref.file.path;
    if (!filePath) {
      skipped++;
      continue;
    }
    const mediaId = episodeMediaId(ref.seriesId, ref.seasonNumber, ref.episodeNumber);
    try {
      const descriptor = await getOrProbeMediaDescriptor(mediaId, filePath, opts?.force);
      if (descriptor) {
        probed++;
        enrichEpisodeFromDescriptor(ref.seriesId, ref.seasonNumber, ref.episodeNumber, descriptor);
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error(`[media-probe] échec pour l'épisode S${ref.seasonNumber}E${ref.episodeNumber} (${ref.seriesId}):`, err);
    }
  }

  onProgress?.(total, total);
  return { probed, skipped, failed, total, seriesCount: allSeries.length };
}

/** Episode equivalent of probeMovieInBackground — same fire-and-forget,
 *  never-blocks-the-import, never-fails-the-import contract. */
export function probeEpisodeInBackground(seriesId: string, seasonNumber: number, episodeNumber: number, filePath: string | null | undefined): void {
  if (!filePath) return;
  const mediaId = episodeMediaId(seriesId, seasonNumber, episodeNumber);
  void getOrProbeMediaDescriptor(mediaId, filePath)
    .then((descriptor) => {
      if (descriptor) enrichEpisodeFromDescriptor(seriesId, seasonNumber, episodeNumber, descriptor);
    })
    .catch((err) => {
      console.error(`[media-probe] échec en arrière-plan pour l'épisode S${seasonNumber}E${episodeNumber} (${seriesId}):`, err);
    });
}

export async function probeAllLibraryMovies(
  onProgress?: (current: number, total: number) => void,
  opts?: { shouldCancel?: () => boolean; force?: boolean }
): Promise<ProbeLibraryResult> {
  const movies = loadMovies().filter((m) => m.file);
  const total = movies.length;
  let probed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < movies.length; i++) {
    if (opts?.shouldCancel?.()) break;
    onProgress?.(i, total);

    const movie = movies[i];
    const filePath = movie.file?.diskPath ?? movie.file?.path;
    if (!filePath) {
      skipped++;
      continue;
    }
    try {
      const descriptor = await getOrProbeMediaDescriptor(movie.id, filePath, opts?.force);
      if (descriptor) {
        probed++;
        enrichMovieFromDescriptor(movie.id, descriptor);
      } else {
        skipped++; // file missing on disk — getOrProbeMediaDescriptor already returned null gracefully
      }
    } catch (err) {
      failed++;
      console.error(`[media-probe] échec pour "${movie.title}" (${movie.id}):`, err);
    }
  }

  onProgress?.(total, total);
  return { probed, skipped, failed, total };
}

/**
 * Fire-and-forget probe for one movie right after its file lands (a fresh
 * import, an auto-grab completion, a Plex sync reconciliation…) — see
 * TODO_POST_MOTEUR_LECTURE.md item 1. Never awaited by callers: probing
 * must not add latency to the import/sync path it's called from, and a
 * probe failure here must never surface as an import failure — the file is
 * genuinely in the library either way, only the cache entry is missing
 * (which getOrProbeMediaDescriptor already tries again next time on-demand).
 */
export function probeMovieInBackground(movieId: string, filePath: string | null | undefined): void {
  if (!filePath) return;
  void getOrProbeMediaDescriptor(movieId, filePath)
    .then((descriptor) => {
      if (descriptor) enrichMovieFromDescriptor(movieId, descriptor);
    })
    .catch((err) => {
      console.error(`[media-probe] échec en arrière-plan pour ${movieId}:`, err);
    });
}
