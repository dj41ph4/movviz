import { WorkerPool } from "./workerPool";
import type { ReleaseInfo } from "@/lib/naming/types";

export interface ReleaseMatchInput {
  releases: { title: string }[];
  targetTitle: string;
  aliases?: string[];
  /** Movie mode. */
  targetYear?: number | null;
  /** Series mode — presence of seasonNumber selects series matching over movie/year matching. */
  seasonNumber?: number;
  episodeNumber?: number | null;
  filterPack?: boolean;
}

export interface ReleaseMatchOutput {
  survivors: { idx: number; parsed: ReleaseInfo }[];
  titleCount: number;
  /** Movies: how many passed the year check. Series: how many passed the season/episode check. */
  secondCount: number;
  /** Series only — how many passed the pack/non-pack check (same as secondCount for movies). */
  packCount: number;
}

const g = globalThis as typeof globalThis & {
  __movvizReleaseMatchPool?: WorkerPool<ReleaseMatchInput, ReleaseMatchOutput>;
};

/**
 * Lazily spawned real worker_threads pool for the CPU-heavy parse+match step
 * shared by every auto-grab path (autoGrab.ts/autoGrabSeries.ts's
 * grabRelease()). Moving this off the main thread is what actually keeps
 * the app responsive during a bulk job — see the comment atop
 * releaseMatchWorker.mjs for the measured event-loop-delay evidence.
 */
export function getReleaseMatchPool(): WorkerPool<ReleaseMatchInput, ReleaseMatchOutput> {
  if (!g.__movvizReleaseMatchPool) {
    g.__movvizReleaseMatchPool = new WorkerPool<ReleaseMatchInput, ReleaseMatchOutput>(
      new URL("./releaseMatchWorker.mjs", import.meta.url)
    );
  }
  return g.__movvizReleaseMatchPool;
}
