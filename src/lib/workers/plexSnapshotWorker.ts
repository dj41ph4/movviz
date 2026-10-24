import { parentPort, workerData } from "node:worker_threads";
import { collectSnapshotWatchState } from "@/lib/plex/plexWatchStateObserver";
import type { PlexUserContext } from "@/lib/plex/plexUserContext";

if (!parentPort) throw new Error("snapshot worker requires parentPort");

try {
  const result = await collectSnapshotWatchState(workerData as PlexUserContext);
  parentPort.postMessage({ kind: "result", value: result });
} catch (error) {
  parentPort.postMessage({ kind: "error", error: error instanceof Error ? error.message : String(error) });
}
