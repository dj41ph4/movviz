import { WorkerPool } from "./workerPool";
import { resolveWorkerUrl } from "./workerPath";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import type { HashIndexResult } from "@/lib/library/hashIndexCompute";

interface HashIndexTaskInput {
  movies: LibraryMovie[];
  series: LibrarySeries[];
}

const g = globalThis as typeof globalThis & {
  __movvizHashIndexPool?: WorkerPool<HashIndexTaskInput, HashIndexResult>;
};

/** Lazily spawns the pool on first use — never during module load, so a
 *  route that never touches the hash index never pays for worker startup. */
export function getHashIndexPool(): WorkerPool<HashIndexTaskInput, HashIndexResult> {
  if (!g.__movvizHashIndexPool) {
    g.__movvizHashIndexPool = new WorkerPool<HashIndexTaskInput, HashIndexResult>(
      resolveWorkerUrl("hashIndexWorker.mjs", import.meta.url)
    );
  }
  return g.__movvizHashIndexPool;
}
