import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

export interface ReplacementFailure {
  reason: "fileInUse" | "nameOccupied" | "incomplete" | "unavailable";
  attempts: number;
  retryAt: number | null;
  discarded: boolean;
}
const FILE = path.join(process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"), "replacement-retries.json");
const INTERVAL = 10 * 60 * 1000;
export class ReplacementRefused extends Error {
  constructor(public failure: ReplacementFailure) { super("replacement_refused"); }
}
/** Called under the movie lock: one initial attempt plus three retries. */
export async function runReplacementAttempt<T>(infoHash: string, attempt: () => Promise<T>, discard: () => Promise<void>): Promise<T> {
  const records = readJsonCached<Record<string, ReplacementFailure>>(FILE, {});
  const previous = records[infoHash];
  if (previous?.discarded || (previous?.retryAt && Date.now() < previous.retryAt)) throw new ReplacementRefused(previous);
  try {
    // After the retry budget is exhausted, only retry cleanup; never another replacement.
    if ((previous?.attempts ?? 0) >= 4) {
      await discard();
      const finished = { ...previous!, discarded: true, retryAt: null };
      writeJsonCached(FILE, { ...readJsonCached<Record<string, ReplacementFailure>>(FILE, {}), [infoHash]: finished });
      throw new ReplacementRefused(finished);
    }
    const result = await attempt();
    if (previous) {
      const fresh = { ...readJsonCached<Record<string, ReplacementFailure>>(FILE, {}) };
      delete fresh[infoHash];
      writeJsonCached(FILE, fresh);
    }
    return result;
  } catch (error) {
    if (error instanceof ReplacementRefused) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    const message = (error as Error).message ?? "";
    const failure: ReplacementFailure = {
      reason: ["EACCES", "EPERM", "EBUSY"].includes(code ?? "") ? "fileInUse" : message.includes("occupé") ? "nameOccupied" : message.includes("incomplet") ? "incomplete" : "unavailable",
      attempts: Math.min(4, (previous?.attempts ?? 0) + 1),
      retryAt: Date.now() + INTERVAL,
      discarded: false,
    };
    if (failure.attempts >= 4) {
      failure.retryAt = null;
      try { await discard(); failure.discarded = true; }
      catch { failure.retryAt = Date.now() + INTERVAL; }
    }
    writeJsonCached(FILE, { ...readJsonCached<Record<string, ReplacementFailure>>(FILE, {}), [infoHash]: failure });
    throw new ReplacementRefused(failure);
  }
}
