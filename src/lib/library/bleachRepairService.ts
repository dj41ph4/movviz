import fs from "node:fs";
import path from "node:path";
import { getSeries, updateSeries } from "./store";
import { planBleachRepair } from "./bleachRepair";
import { inspectBleachRepairState } from "./bleachRepairState";
import { withKeyLock } from "./locks";
import { BLEACH_TMDB_ID, detectBleachLibraryOrder, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { getSeason } from "@/lib/metadata/tmdb";
import { bleachEpisodeInScope, type BleachSeriesPart } from "./bleachScope";

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
  if (current?.tmdbId === BLEACH_TMDB_ID && !current.episodeOrder && detectBleachLibraryOrder(current) === "tvdb") {
    return updateSeries(id, { episodeOrder: "tvdb" });
  }
  if (!current || !needsBleachRepair(current)) return current;
  return withKeyLock(`series:${id}`, async () => {
    const latest = getSeries(id);
    if (!latest || !needsBleachRepair(latest)) return latest;
    const plan = previewBleachRepair(id);
    if (plan?.applicable) commitBleachRepair(plan);
    return getSeries(id);
  });
}

/** Refresh metadata at known coordinates; never flatten a repaired anime again. */
export async function refreshBleachMetadata(id: string, part?: BleachSeriesPart | null) {
  await ensureBleachRepaired(id);
  return withKeyLock(`series:${id}`, async () => {
    const series = getSeries(id);
    if (!series) return { ok: false as const, error: "not_found" as const };
    if (needsBleachRepair(series)) return { ok: false as const, error: "bleach_repair_required" as const };
    const seasons = [...series.seasons];
    let refreshed = 0;
    for (let index = 0; index < seasons.length; index++) {
      const season = seasons[index];
      if (part && !season.episodes.some(e => bleachEpisodeInScope(season.seasonNumber, e.episodeNumber, part))) continue;
      const detail = await getSeason(BLEACH_TMDB_ID, season.seasonNumber);
      if (!detail) continue;
      refreshed++;
      seasons[index] = { ...season, name: detail.name, episodes: season.episodes.map(episode => {
        const metadata = detail.episodes.find(e => e.episodeNumber === episode.episodeNumber);
        return metadata ? { ...episode, title: metadata.title, airDate: metadata.airDate } : episode;
      }) };
    }
    if (!refreshed) return { ok: false as const, error: "no_tvdb_match" as const };
    const latest = getSeries(id);
    if (!latest) return { ok: false as const, error: "not_found" as const };
    // Downloads and Plex callbacks may advance while metadata is fetched.
    // Merge only descriptive fields into the latest episode records.
    const merged = latest.seasons.map(season => {
      const metadata = seasons.find(s => s.seasonNumber === season.seasonNumber);
      if (!metadata || (part && !season.episodes.some(e => bleachEpisodeInScope(season.seasonNumber, e.episodeNumber, part)))) return season;
      return { ...season, name: metadata.name, episodes: season.episodes.map(episode => {
        const detail = metadata.episodes.find(e => e.episodeNumber === episode.episodeNumber);
        return detail ? { ...episode, title: detail.title, airDate: detail.airDate } : episode;
      }) };
    });
    updateSeries(id, { seasons: merged, episodeOrder: "tvdb" });
    return { ok: true as const, oldSeasonCount: series.seasons.length, newSeasonCount: merged.length };
  });
}
