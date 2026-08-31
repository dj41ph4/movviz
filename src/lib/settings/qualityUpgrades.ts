import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "quality-upgrades.json");

/**
 * The Settings > Activité toggle for "auto-upgrade already-downloaded
 * movies" used to live only in the browser's localStorage — the scheduled
 * task that actually re-grabs upgrades (checkQualityUpgrades) never read it,
 * so turning it off did nothing server-side. Persisted here instead so the
 * task can actually respect it.
 */
export function isQualityUpgradesEnabled(): boolean {
  return readJsonCached<{ enabled?: boolean }>(FILE, {}).enabled ?? true;
}

export function setQualityUpgradesEnabled(enabled: boolean): void {
  writeJsonCached(FILE, { enabled });
}
