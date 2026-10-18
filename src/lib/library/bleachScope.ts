import { BLEACH_TMDB_ID, BLEACH_TYBW_COURS, knownBleachEpisode } from "@/lib/metadata/bleachEpisodeOrder";
import type { LibrarySeries } from "./types";

export type BleachSeriesPart = "original" | "tybw";
export function parseBleachSeriesPart(value: unknown): BleachSeriesPart | null {
  return value === "original" || value === "tybw" ? value : null;
}
export function bleachSeasonNumbers(part: BleachSeriesPart): number[] {
  return part === "tybw" ? [17] : Array.from({ length: 16 }, (_, i) => i + 1);
}
export function bleachEpisodeInScope(season: number, episode: number, part?: BleachSeriesPart | null, cour?: number): boolean {
  if (!knownBleachEpisode(season, episode)) return false;
  if (part === "original" && season > 16) return false;
  if (part === "tybw" && season !== 17) return false;
  if (cour != null) {
    const range = BLEACH_TYBW_COURS.find(c => c.part === cour);
    return !!range && season === 17 && episode > range.offset && episode <= range.offset + range.count;
  }
  return true;
}
/** Ephemeral acquisition view. All writes still use the original series ID. */
export function scopedBleachSeries(series: LibrarySeries, part?: BleachSeriesPart | null, cour?: number): LibrarySeries {
  if (series.tmdbId !== BLEACH_TMDB_ID) return series;
  return { ...series, seasons: series.seasons.map(s => ({ ...s, episodes: s.episodes.filter(e => bleachEpisodeInScope(s.seasonNumber, e.episodeNumber, part, cour)) })).filter(s => s.episodes.length > 0) };
}
