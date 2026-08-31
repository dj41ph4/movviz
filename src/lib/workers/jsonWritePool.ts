import { WorkerPool } from "./workerPool";
import { resolveWorkerUrl } from "./workerPath";

interface JsonWriteTaskInput {
  file: string;
  value: unknown;
}

interface JsonWriteTaskOutput {
  mtimeMs: number;
  size: number;
}

const g = globalThis as typeof globalThis & {
  __movvizJsonWritePool?: WorkerPool<JsonWriteTaskInput, JsonWriteTaskOutput>;
};

/** Lazily spawns the pool on first large write — routes never touching a
 *  large store never pay for worker startup. */
export function getJsonWritePool(): WorkerPool<JsonWriteTaskInput, JsonWriteTaskOutput> {
  if (!g.__movvizJsonWritePool) {
    g.__movvizJsonWritePool = new WorkerPool<JsonWriteTaskInput, JsonWriteTaskOutput>(
      resolveWorkerUrl("jsonWriteWorker.mjs", import.meta.url)
    );
  }
  return g.__movvizJsonWritePool;
}
