/**
 * Phase 2 — bulk probe entry point (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §8: "à l'import ou à la découverte d'un nouveau fichier"). Walks every
 * owned movie with a local file and warms the MediaDescriptor cache for it,
 * so later playback decisions never pay ffprobe's cost. Triggered from
 * Réglages > Maintenance (MediaProbePanel.tsx) via the shared job queue —
 * see /api/library/media-probe/scan.
 */

import { loadMovies } from "@/lib/library/store";
import { getOrProbeMediaDescriptor } from "./mediaProbeCache";

export interface ProbeLibraryResult {
  probed: number;
  skipped: number;
  failed: number;
  total: number;
}

export async function probeAllLibraryMovies(
  onProgress?: (current: number, total: number) => void,
  opts?: { shouldCancel?: () => boolean }
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
      const descriptor = await getOrProbeMediaDescriptor(movie.id, filePath);
      if (descriptor) probed++;
      else skipped++; // file missing on disk — getOrProbeMediaDescriptor already returned null gracefully
    } catch (err) {
      failed++;
      console.error(`[media-probe] échec pour "${movie.title}" (${movie.id}):`, err);
    }
  }

  onProgress?.(total, total);
  return { probed, skipped, failed, total };
}
