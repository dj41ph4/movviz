import { WorkerPool } from "./workerPool";
import type { ReleaseInfo } from "@/lib/naming/types";
import { parseRelease } from "@/lib/naming/parser";
import {
  releaseTitleMatches,
  seasonEpisodeMatches,
  yearIsCompatible,
} from "@/lib/library/matching";

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
  /** Single-season series only (DVD-ordering part packs): total episode
   *  count of the sole season, enables the part-pack fallback in the
   *  worker's seasonEpisodeMatches. Null/absent for multi-season series. */
  partTotalEpisodes?: number | null;
}

export interface ReleaseMatchOutput {
  survivors: { idx: number; parsed: ReleaseInfo }[];
  titleCount: number;
  /** Movies: how many passed the year check. Series: how many passed the season/episode check. */
  secondCount: number;
  /** Series only — how many passed the pack/non-pack check (same as secondCount for movies). */
  packCount: number;
}

/**
 * Same pure matching work as releaseMatchWorker.mjs, kept here as the safe
 * in-process fallback.  Worker files are occasionally omitted by a packaged
 * Next.js deployment; a missing optimisation must never turn an "add to
 * library" action into a 500 after the library record was already created.
 */
function matchInProcess(input: ReleaseMatchInput): ReleaseMatchOutput {
  const isSeries = input.seasonNumber != null;
  const step1 = input.releases.map((release, idx) => ({
    idx,
    parsed: parseRelease(release.title),
  }));
  const step2 = step1.filter(({ parsed }) =>
    releaseTitleMatches(parsed.title, input.targetTitle, input.aliases ?? [], {
      year: parsed.year ?? null,
      targetYear: input.targetYear ?? null,
    }),
  );
  const step3 = isSeries
    ? step2.filter(({ parsed }) =>
        seasonEpisodeMatches(
          parsed,
          input.seasonNumber!,
          input.filterPack ? null : (input.episodeNumber ?? null),
          input.partTotalEpisodes ?? null,
        ),
      )
    : step2.filter(({ parsed }) => yearIsCompatible(parsed.year, input.targetYear ?? null));
  const step4 = isSeries
    ? step3.filter(({ parsed }) => (input.filterPack ? parsed.episode == null : true))
    : step3;

  return {
    survivors: step4.map(({ idx, parsed }) => ({ idx, parsed })),
    titleCount: step2.length,
    secondCount: step3.length,
    packCount: step4.length,
  };
}

class ReleaseMatchRunner {
  private workerUnavailable = false;

  constructor(private readonly pool: WorkerPool<ReleaseMatchInput, ReleaseMatchOutput>) {}

  async run(input: ReleaseMatchInput): Promise<ReleaseMatchOutput> {
    if (this.workerUnavailable) return matchInProcess(input);
    try {
      return await this.pool.run(input);
    } catch (error) {
      // The worker only protects responsiveness during large bulk searches.
      // A direct add/search is correctness-critical, so preserve the exact
      // filtering semantics on the main process rather than failing its API
      // request (and leaving a newly added title silently "missing").
      console.error("[release-match] worker unavailable; using in-process fallback:", error);
      this.workerUnavailable = true;
      this.pool.close();
      return matchInProcess(input);
    }
  }
}

const g = globalThis as typeof globalThis & {
  __movvizReleaseMatchPool?: ReleaseMatchRunner;
};

/**
 * Lazily spawned real worker_threads pool for the CPU-heavy parse+match step
 * shared by every auto-grab path (autoGrab.ts/autoGrabSeries.ts's
 * grabRelease()). Moving this off the main thread is what actually keeps
 * the app responsive during a bulk job — see the comment atop
 * releaseMatchWorker.mjs for the measured event-loop-delay evidence.
 */
export function getReleaseMatchPool(): ReleaseMatchRunner {
  if (!g.__movvizReleaseMatchPool) {
    g.__movvizReleaseMatchPool = new ReleaseMatchRunner(
      new WorkerPool<ReleaseMatchInput, ReleaseMatchOutput>(
        new URL("./releaseMatchWorker.mjs", import.meta.url)
      )
    );
  }
  return g.__movvizReleaseMatchPool;
}
