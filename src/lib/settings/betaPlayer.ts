import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "beta-player.json");

export function isBetaPlayerEnabled(): boolean {
  return readJsonCached<{ enabled?: boolean }>(FILE, {}).enabled ?? false;
}

export function setBetaPlayerEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled });
}
