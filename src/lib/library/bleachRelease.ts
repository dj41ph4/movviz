import { parseRelease } from "@/lib/naming/parser";
import { bleachReleaseCoordinate, isBleachSequelTitle, bleachNamedCour, bleachCourForEpisode, BLEACH_TYBW_COURS, knownBleachEpisode } from "@/lib/metadata/bleachEpisodeOrder";
export { isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";

export function bleachReleaseTargets(targets: { season: number; episode: number }[], title: string) {
  const parsed = parseRelease(title);
  const sequel = isBleachSequelTitle(title);
  const named = bleachNamedCour(title);
  const rangeMatch = title.match(/\bS(\d{1,2})\s*(?:[-–]|to|a|à)\s*S?(\d{1,2})\b/i);
  const range = rangeMatch ? { lo: Number(rangeMatch[1]), hi: Number(rangeMatch[2]) } : null;
  return targets.flatMap(library => {
    if (!knownBleachEpisode(library.season, library.episode)) return [];
    if (!sequel) {
      // An unqualified Bleach S01/S02 always belongs to the original run.
      if (library.season === 17 && parsed.season !== 17) return [];
      if (range ? library.season < range.lo || library.season > range.hi : parsed.season != null && parsed.season !== library.season) return [];
      if (parsed.episode != null && (library.episode < parsed.episode || library.episode > (parsed.episodeEnd ?? parsed.episode))) return [];
      return [{ ...library, library: { ...library } }];
    }
    if (library.season !== 17) return [];
    if (parsed.season === 17) {
      if (parsed.episode != null && (library.episode < parsed.episode || library.episode > (parsed.episodeEnd ?? parsed.episode))) return [];
      return [{ season: 17, episode: library.episode, library: { ...library } }];
    }
    const cour = range ? bleachCourForEpisode(library.episode) : BLEACH_TYBW_COURS.find(c => c.part === (named ?? parsed.season));
    if (!cour || bleachCourForEpisode(library.episode)?.part !== cour.part) return [];
    if (range && (cour.part < range.lo || cour.part > range.hi)) return [];
    let sourceEpisode = library.episode - cour.offset;
    if (parsed.episode != null) {
      const first = bleachReleaseCoordinate(title, parsed.season, parsed.episode);
      const last = bleachReleaseCoordinate(title, parsed.season, parsed.episodeEnd ?? parsed.episode);
      if (!first || !last || library.episode < first.episodeNumber || library.episode > last.episodeNumber) return [];
      sourceEpisode = parsed.episode + library.episode - first.episodeNumber;
    }
    return [{ season: range ? cour.part : parsed.season ?? 1, episode: sourceEpisode, library: { ...library } }];
  });
}

/** Source queries never send a Bleach-wide TVDB ID for a standalone TYBW part. */
export function bleachIndexerQueries(season: number, episode?: number | null, courPart?: number) {
  if (season !== 17) return [{ title: "Bleach", season, episode: episode ?? null, tvdbId: 74796 }];
  const cours = courPart != null ? BLEACH_TYBW_COURS.filter(c => c.part === courPart) : episode != null ? BLEACH_TYBW_COURS.filter(c => bleachCourForEpisode(episode)?.part === c.part) : BLEACH_TYBW_COURS;
  return cours.map(c => ({ title: "Bleach Thousand-Year Blood War", season: c.part, episode: episode == null ? null : episode - c.offset, tvdbId: null }));
}

export function bleachReleaseYearCompatible(title: string, season: number): boolean {
  const year = parseRelease(title).year;
  if (!year) return true;
  const n = Number(year);
  return season === 17 ? n >= 2022 : n >= 2004 && n <= 2012;
}

/** A complete pick must actually cover every requested episode of this fiche. */
export function bleachCompletePackCovers(title: string, targets: { season: number; episode: number }[]): boolean {
  return targets.length > 0 && parseRelease(title).episode == null &&
    /complete|integral|intégral|\bS\d+[-–]|\bpack\b/i.test(title) &&
    bleachReleaseYearCompatible(title, targets.every(t => t.season === 17) ? 17 : 1) &&
    bleachReleaseTargets(targets, title).length === targets.length;
}

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
