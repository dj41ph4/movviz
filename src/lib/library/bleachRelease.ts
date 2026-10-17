import { parseRelease } from "@/lib/naming/parser";
import { bleachReleaseCoordinate, isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";
export { isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";

/** Only rewrite matching input. Preserve the real release title for download. */
export function bleachMatchingTitle(title: string, targetSeason: number, filterPack: boolean): string {
  if (!isBleachSequelTitle(title)) return title;
  if (targetSeason !== 17) return "__different_bleach_series__";
  const parsed = parseRelease(title);
  if (filterPack) {
    if (parsed.episode != null) return "__not_a_bleach_pack__";
    return parsed.season === 17 ? title : `Bleach.S17.${title.replace(/\bS\d{1,2}\b/gi, "")}`;
  }
  const mapped = bleachReleaseCoordinate(title, parsed.season, parsed.episode);
  if (!mapped) return "__unmapped_bleach_episode__";
  // Technical tokens remain available to the ordinary quality-profile parser.
  return `Bleach.S17E${String(mapped.episodeNumber).padStart(2, "0")}.${title.replace(/^.*?S\d{1,2}E\d{1,3}/i, "")}`;
}

/** Source coordinates required by the download engine's file selector. */
export function bleachReleaseSource(title: string, season: number, episode: number): { seasonNumber: number; episodeNumber: number } | null {
  if (season !== 17 || !isBleachSequelTitle(title)) return null;
  const parsed = parseRelease(title);
  if (parsed.episode == null) return null;
  const mapped = bleachReleaseCoordinate(title, parsed.season, parsed.episode);
  if (mapped?.episodeNumber !== episode) return null;
  return { seasonNumber: parsed.season ?? 1, episodeNumber: parsed.episode };
}
