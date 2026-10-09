import { Worker } from "node:worker_threads";
import os from "node:os";

/**
 * Minimal fixed-size worker_threads pool. Built narrowly for one job shape
 * (input → output over postMessage), not a general multi-job-type task
 * queue — if a second kind of background computation ever needs this, give
 * it its own pool/worker script rather than overloading this one.
 *
 * Anchored on globalThis in the caller (see hashIndexPool.ts) — Next.js
 * bundles routes into separate module instances, so a plain module-level
 * pool would spawn once per bundle instead of once per process.
 */
export class WorkerPool<TIn, TOut> {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private closed = false;
  private queue: {
    input: TIn;
    resolve: (out: TOut) => void;
    reject: (err: Error) => void;
  }[] = [];
  private pending = new Map<
    Worker,
    { resolve: (out: TOut) => void; reject: (err: Error) => void }
  >();
  private retiring = new Set<Worker>();

  constructor(
    private workerUrl: URL,
    private size = Math.max(1, Math.min(2, os.cpus().length - 1))
  ) {
    for (let i = 0; i < this.size; i++) this.spawnWorker();
  }

  private spawnWorker() {
    if (this.closed) return;
    const worker = new Worker(this.workerUrl);

    worker.on("message", (result: { ok: true; value: TOut } | { ok: false; error: string }) => {
      if (this.retiring.has(worker) || this.closed) return;
      const task = this.pending.get(worker);
      this.pending.delete(worker);
      if (task) {
        if (result.ok) task.resolve(result.value);
        else task.reject(new Error(result.error));
      }
      this.idle.push(worker);
      this.dispatch();
    });

    // A worker that crashes (not just an in-band error message) fails
    // whatever task it was holding, then gets replaced so the pool stays at
    // full size — a bad input killing one worker shouldn't degrade every
    // future task's throughput forever.
    worker.on("error", (err: Error) => {
      void this.replaceWorker(worker, err);
    });
    worker.on("exit", () => {
      if (!this.closed && !this.retiring.has(worker)) {
        void this.replaceWorker(worker, new Error("worker exited before replying"));
      }
    });

    this.workers.push(worker);
    this.idle.push(worker);
  }

  private async replaceWorker(worker: Worker, error: Error) {
    if (this.closed || this.retiring.has(worker)) return;
    this.retiring.add(worker);
    this.workers = this.workers.filter((w) => w !== worker);
    this.idle = this.idle.filter((w) => w !== worker);
    const task = this.pending.get(worker);
    this.pending.delete(worker);
    // Wait for termination BEFORE releasing the caller's per-file lock:
    // an expired writer must never overwrite a newer retry afterwards.
    await worker.terminate();
    task?.reject(error);
    if (!this.closed) {
      this.spawnWorker();
      this.dispatch();
    }
    this.retiring.delete(worker);
  }

  private dispatch() {
    if (this.idle.length === 0 || this.queue.length === 0) return;
    const worker = this.idle.shift()!;
    const task = this.queue.shift()!;
    this.pending.set(worker, { resolve: task.resolve, reject: task.reject });
    try {
      worker.postMessage(task.input);
    } catch (error) {
      this.pending.delete(worker);
      this.idle.push(worker);
      task.reject(error instanceof Error ? error : new Error(String(error)));
      this.dispatch();
    }
  }

  /** Runs one task on the pool, rejecting if no worker replies within `timeoutMs`. */
  run(input: TIn, timeoutMs = 10_000): Promise<TOut> {
    if (this.closed) return Promise.reject(new Error("worker pool closed"));
    return new Promise((resolve, reject) => {
      const task = {
        input,
        resolve: (v: TOut) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      const timer = setTimeout(() => {
        const queued = this.queue.indexOf(task);
        if (queued >= 0) {
          this.queue.splice(queued, 1);
          task.reject(new Error("worker queue timed out"));
          return;
        }
        for (const [worker, active] of this.pending) {
          if (active.resolve === task.resolve) {
            console.error("[watchdog] worker bloqué : remplacement après expiration du délai");
            void this.replaceWorker(worker, new Error("worker task timed out"));
            return;
          }
        }
      }, timeoutMs);
      this.queue.push(task);
      this.dispatch();
    });
  }

  /** Stops this pool permanently. Callers that have a synchronous fallback
   * use it after an infrastructure failure so broken worker startup cannot
   * spin/retry forever in the background. */
  close() {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    const error = new Error("worker pool closed");
    for (const task of this.queue.splice(0)) task.reject(error);
    for (const task of this.pending.values()) task.reject(error);
    this.pending.clear();
    const stopped = Promise.allSettled([...new Set([...this.workers, ...this.retiring])].map((worker) => worker.terminate()));
    this.workers = [];
    this.idle = [];
    return stopped.then(() => {});
  }
}
