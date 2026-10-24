import { Worker } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PlexUserContext } from "@/lib/plex/plexUserContext";
import type { PlexObservedState } from "@/lib/plex/plexObservedState";
import type { upsertMappings } from "@/lib/plex/mediaIdentityMap";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

type Result =
  | { ok: true; states: PlexObservedState[]; movieRatingKeys: string[]; showRatingKeys: string[]; episodeRatingKeys: string[]; mappings: Parameters<typeof upsertMappings>[0] }
  | { ok: false; reason: string };

const WORKER_TIMEOUT_MS = 30 * 60_000;
const globalState = globalThis as typeof globalThis & {
  __movvizPlexSnapshotRuns?: Map<string, Promise<Result>>;
  __movvizPlexSnapshotTail?: Promise<void>;
};

export function runPlexSnapshotWorker(ctx: PlexUserContext): Promise<Result> {
  // Tests and local development retain the existing collector. Production
  // always uses the worker; a missing worker fails closed without blocking web.
  if (process.env.NODE_ENV !== "production") {
    return import("@/lib/plex/plexWatchStateObserver").then((module) => module.collectSnapshotWatchState(ctx));
  }
  const key = `${ctx.movvizUserId}:${ctx.machineIdentifier}`;
  const runs = (globalState.__movvizPlexSnapshotRuns ??= new Map());
  const current = runs.get(key);
  if (current) return current;
  const run = () => new Promise<Result>((resolve, reject) => {
    const workerPath = path.join(process.cwd(), "workers", "plexSnapshotWorker.mjs");
    const worker = new Worker(pathToFileURL(workerPath), {
      workerData: ctx,
      env: { ...process.env, MOVVIZ_SNAPSHOT_WORKER: "1" },
    });
    let settled = false;
    const finish = (error?: Error, value?: Result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error("snapshot worker timed out")), WORKER_TIMEOUT_MS);
    worker.on("message", (message: { kind: "log"; level: "info" | "warn" | "error" | "debug"; step: string; message: string; ms?: number } | { kind: "result"; value: Result } | { kind: "error"; error: string }) => {
      if (message.kind === "log") recordSearchLog(message.level, message.step, message.message, message.ms);
      else if (message.kind === "result") finish(undefined, message.value);
      else finish(new Error(message.error));
    });
    worker.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    worker.on("exit", (code) => finish(new Error(`snapshot worker exited (${code})`)));
  });
  const task = (globalState.__movvizPlexSnapshotTail ?? Promise.resolve()).then(run);
  globalState.__movvizPlexSnapshotTail = task.then(() => undefined, () => undefined);
  runs.set(key, task);
  void task.finally(() => {
    if (runs.get(key) === task) runs.delete(key);
  }).catch(() => undefined);
  return task;
}
