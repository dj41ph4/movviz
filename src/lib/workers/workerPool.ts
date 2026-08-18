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
      const task = this.pending.get(worker);
      this.pending.delete(worker);
      if (task) task.reject(err);
      this.workers = this.workers.filter((w) => w !== worker);
      this.idle = this.idle.filter((w) => w !== worker);
      // A caller may deliberately close this pool after a packaging failure
      // (e.g. a worker file missing from a standalone deployment). In that
      // case respawning would produce an endless error loop and keep Node
      // alive even though its caller has already switched to a safe fallback.
      if (!this.closed) this.spawnWorker();
    });

    this.workers.push(worker);
    this.idle.push(worker);
  }

  private dispatch() {
    if (this.idle.length === 0 || this.queue.length === 0) return;
    const worker = this.idle.shift()!;
    const task = this.queue.shift()!;
    this.pending.set(worker, { resolve: task.resolve, reject: task.reject });
    worker.postMessage(task.input);
  }

  /** Runs one task on the pool, rejecting if no worker replies within `timeoutMs`. */
  run(input: TIn, timeoutMs = 10_000): Promise<TOut> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("worker task timed out")), timeoutMs);
      this.queue.push({
        input,
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.dispatch();
    });
  }

  /** Stops this pool permanently. Callers that have a synchronous fallback
   * use it after an infrastructure failure so broken worker startup cannot
   * spin/retry forever in the background. */
  close() {
    if (this.closed) return;
    this.closed = true;
    const error = new Error("worker pool closed");
    for (const task of this.queue.splice(0)) task.reject(error);
    for (const task of this.pending.values()) task.reject(error);
    this.pending.clear();
    for (const worker of this.workers) void worker.terminate().catch(() => {});
    this.workers = [];
    this.idle = [];
  }
}
