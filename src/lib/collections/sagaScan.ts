import { loadMovies, updateMovies } from "@/lib/library/store";
import type { LibraryMovie } from "@/lib/library/types";
import { getMovie } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";
import { enqueueJob, getJobsByType, isTypeActive } from "@/lib/jobs/queue";
import type { Job } from "@/lib/jobs/types";

/**
 * One-time backfill for movies added before `tmdbCollectionId` existed —
 * `undefined` means "never checked", so this only ever (re)fetches those,
 * not every movie in the library. Runs as a background job through the
 * shared job queue instead of its own bespoke fire-and-forget + status
 * file, so it shares concurrency/priority with every other heavy scan.
 */
export function startSagaScan(): Job {
  const pending = loadMovies().filter((m) => m.tmdbCollectionId === undefined);
  return enqueueJob("sagaScan", "Scan des sagas", pending.length, async (setProgress) => {
    if (pending.length === 0) return;
    let scanned = 0;
    // Batched instead of one full-library-file rewrite per movie — a rewrite
    // per item, with concurrent TMDb cache hits resolving near-instantly,
    // used to pile up disk writes (and their in-memory JSON copies) faster
    // than they could flush, which is what drove the OOM crashes this
    // feature caused before. See updateMovies().
    const pendingPatches = new Map<string, Partial<LibraryMovie>>();
    const flush = () => {
      if (pendingPatches.size === 0) return;
      updateMovies(new Map(pendingPatches));
      pendingPatches.clear();
    };
    await mapWithConcurrency(pending, 5, async (movie) => {
      try {
        const meta = await getMovie(movie.tmdbId);
        pendingPatches.set(movie.id, { tmdbCollectionId: meta?.collectionId ?? null });
      } catch {
        // Leave it undefined — picked up again by the next scan instead of wrongly marked "no saga".
      }
      scanned++;
      if (scanned % 20 === 0) {
        flush();
        setProgress(scanned, pending.length);
        const mem = process.memoryUsage();
        console.log(
          `[sagaScan] progress ${scanned}/${pending.length} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`
        );
      }
    });
    flush();
    setProgress(scanned, pending.length);
  });
}

export function isSagaScanRunning(): boolean {
  return isTypeActive("sagaScan");
}

export function getLatestSagaScanJob(): Job | null {
  return getJobsByType("sagaScan")[0] ?? null;
}
