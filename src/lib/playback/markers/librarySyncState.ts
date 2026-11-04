import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "introdb-sync-state.json");

export interface IntroDbSyncState {
  /** La première passe de nuit est allée au bout : tout titre sans état est désormais un ajout récent. */
  firstPassDone: boolean;
  lastFullAt: number | null;
  lastNewAt: number | null;
}

export function loadIntroDbSyncState(): IntroDbSyncState {
  const raw = readJsonCached<Partial<IntroDbSyncState>>(FILE, {});
  return {
    firstPassDone: raw.firstPassDone === true,
    lastFullAt: typeof raw.lastFullAt === "number" ? raw.lastFullAt : null,
    lastNewAt: typeof raw.lastNewAt === "number" ? raw.lastNewAt : null,
  };
}

export function saveIntroDbSyncState(state: IntroDbSyncState): void {
  writeJsonCached(FILE, state);
}
