/**
 * Phase 2 — bulk probe entry point (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §8: "à l'import ou à la découverte d'un nouveau fichier"). Walks every
 * owned movie with a local file and warms the MediaDescriptor cache for it,
 * so later playback decisions never pay ffprobe's cost. Triggered from
 * Réglages > Maintenance (MediaProbePanel.tsx) via the shared job queue —
 * see /api/library/media-probe/scan.
 */

import { getMovie, loadMovies, updateMovie } from "@/lib/library/store";
import { getPrimaryFile, setPrimaryFile } from "@/lib/library/versions";
import type { LibraryFile } from "@/lib/library/types";
import { getOrProbeMediaDescriptor } from "./mediaProbeCache";
import { fileFieldsFromDescriptor } from "./mediaDescriptorEnrich";
import type { MediaDescriptor } from "./mediaDescriptor";

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
