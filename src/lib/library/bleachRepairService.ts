import fs from "node:fs";
import path from "node:path";
import { getSeries, updateSeries } from "./store";
import { planBleachRepair } from "./bleachRepair";
import { inspectBleachRepairState } from "./bleachRepairState";
import { withKeyLock } from "./locks";
import { needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";

export function previewBleachRepair(id: string) {
  const series = getSeries(id);
  if (!series) return null;
  const state = inspectBleachRepairState(id, series.seasons.flatMap(s => s.episodes.flatMap(e => e.plexRatingKey ? [e.plexRatingKey] : [])));
  const plan = planBleachRepair(series, state.tracked, state.fingerprint);
  plan.blockers = [...new Set([...plan.blockers, ...state.blockers])];
  plan.applicable = plan.blockers.length === 0;
  return plan;
}

/** Synchronous commit under series lock: no writes or file moves before the backup succeeds. */
export function commitBleachRepair(plan: NonNullable<ReturnType<typeof previewBleachRepair>>) {
  if (!plan.applicable) throw new Error("bleach_repair_blocked");
  const dir = path.join(process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"), "repair-snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const snapshot = `bleach-${Date.now()}-${plan.fingerprint.slice(0, 12)}.json`;
  fs.writeFileSync(path.join(dir, snapshot), JSON.stringify({ series: getSeries(plan.seriesId), plan: { ...plan, next: undefined }, createdAt: Date.now() }), { encoding: "utf8", flag: "wx" });
  updateSeries(plan.seriesId, { seasons: plan.next.seasons, episodeOrder: "tvdb" });
  return snapshot;
}

/** Upgrade an unambiguous legacy catalogue automatically; ambiguous user history stays untouched. */
export async function ensureBleachRepaired(id: string) {
  const current = getSeries(id);
  if (!current || !needsBleachRepair(current)) return current;
  return withKeyLock(`series:${id}`, async () => {
    const latest = getSeries(id);
    if (!latest || !needsBleachRepair(latest)) return latest;
    const plan = previewBleachRepair(id);
    if (plan?.applicable) commitBleachRepair(plan);
    return getSeries(id);
  });
}
