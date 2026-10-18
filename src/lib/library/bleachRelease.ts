import { parseRelease } from "@/lib/naming/parser";
import { bleachReleaseCoordinate, isBleachSequelTitle, bleachNamedCour, bleachCourForEpisode, BLEACH_TYBW_COURS, BLEACH_ORIGINAL_COUNTS, bleachToTmdb, knownBleachEpisode } from "@/lib/metadata/bleachEpisodeOrder";
import type { LibraryRef } from "@/lib/library/types";
export { isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";

export function bleachReleaseTargets(targets: { season: number; episode: number }[], title: string) {
  const parsed = parseRelease(title);
  const sequel = isBleachSequelTitle(title);
  const absoluteRange = originalAbsoluteEpisodeRange(title, parsed);
  const named = bleachNamedCour(title);
  const rangeMatch = title.match(/\bS(\d{1,2})\s*(?:[-–]|to|a|à)\s*S?(\d{1,2})\b/i);
  const range = rangeMatch ? { lo: Number(rangeMatch[1]), hi: Number(rangeMatch[2]) } : null;
  return targets.flatMap(library => {
    if (!knownBleachEpisode(library.season, library.episode)) return [];
    if (!sequel) {
      // TMDb and some complete packs number all 366 original episodes as
      // Bleach S01E001-S01E366. Movviz tracks aired seasons, so translate the
      // source's absolute episode into the matching season/local episode,
      // while retaining the S01/absolute source coordinate for the engine.
      if (absoluteRange) {
        if (library.season < 1 || library.season > 16) return [];
        const absolute = bleachToTmdb(library.season, library.episode);
        if (!absolute || absolute.seasonNumber !== 1 || absolute.episodeNumber < absoluteRange.start || absolute.episodeNumber > absoluteRange.end) return [];
        return [{ season: 1, episode: absolute.episodeNumber, library: { ...library } }];
      }
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
  // Indexers disagree on TYBW numbering: some restart each cour at S01-S04,
  // while others list all episodes under Bleach S17E01-S17E50. Query both
  // representations so season 17 acquisitions do not stop after the first
  // release naming convention.
  return [
    { title: "Bleach", season: 17, episode: episode ?? null, tvdbId: null },
    ...cours.map(c => ({ title: "Bleach Thousand-Year Blood War", season: c.part, episode: episode == null ? null : episode - c.offset, tvdbId: null })),
  ];
}

export function bleachReleaseYearCompatible(title: string, season: number): boolean {
  const year = parseRelease(title).year;
  if (!year) return true;
  const n = Number(year);
  return season === 17 ? n >= 2022 : n >= 2004 && n <= 2012;
}

/** A complete pick must actually cover every requested episode of this fiche. */
export function bleachCompletePackCovers(title: string, targets: { season: number; episode: number }[]): boolean {
  const parsed = parseRelease(title);
  const absoluteRange = originalAbsoluteEpisodeRange(title, parsed);
  const fullAbsoluteCatalogue = absoluteRange?.start === 1 && absoluteRange.end >= BLEACH_ORIGINAL_COUNTS.reduce((sum, count) => sum + count, 0);
  return targets.length > 0 && (parsed.episode == null || fullAbsoluteCatalogue) &&
    (/complete|integral|intégral|\bS\d+[-–]|\bpack\b/i.test(title) || fullAbsoluteCatalogue) &&
    bleachReleaseYearCompatible(title, targets.every(t => t.season === 17) ? 17 : 1) &&
    bleachReleaseTargets(targets, title).length === targets.length;
}

export function bleachManualSearchTargets(ref: LibraryRef, part: "original" | "tybw", courPart?: number): { season: number; episode: number }[] {
  if (ref.kind === "movie") return [];
  if (ref.kind === "episode") return (part === "tybw" ? ref.season === 17 : ref.season >= 1 && ref.season <= 16)
    ? [{ season: ref.season, episode: ref.episode }]
    : [];
  if (ref.kind === "season") {
    if (part === "tybw" && ref.season === 17) {
      const cour = BLEACH_TYBW_COURS.find(item => item.part === courPart);
      const selected = cour ? [cour] : BLEACH_TYBW_COURS;
      return selected.flatMap(item => Array.from({ length: item.count }, (_, index) => ({ season: 17, episode: item.offset + index + 1 })));
    }
    if (part === "original" && ref.season >= 1 && ref.season <= 16) {
      return Array.from({ length: BLEACH_ORIGINAL_COUNTS[ref.season - 1] }, (_, index) => ({ season: ref.season, episode: index + 1 }));
    }
    return [];
  }
  return part === "tybw"
    ? BLEACH_TYBW_COURS.flatMap(cour => Array.from({ length: cour.count }, (_, index) => ({ season: 17, episode: cour.offset + index + 1 })))
    : BLEACH_ORIGINAL_COUNTS.flatMap((count, index) => Array.from({ length: count }, (_, episode) => ({ season: index + 1, episode: episode + 1 })));
}

function originalAbsoluteEpisodeRange(title: string, parsed = parseRelease(title)): { start: number; end: number } | null {
  if (isBleachSequelTitle(title) || parsed.season !== 1) return null;
  const maxAbsoluteEpisode = BLEACH_ORIGINAL_COUNTS.reduce((sum, count) => sum + count, 0);
  if (parsed.episode != null && (parsed.episode > BLEACH_ORIGINAL_COUNTS[0] || (parsed.episodeEnd ?? 0) > BLEACH_ORIGINAL_COUNTS[0])) {
    return { start: parsed.episode, end: parsed.episodeEnd ?? parsed.episode };
  }
  if (parsed.episode == null && new RegExp(`\\b${maxAbsoluteEpisode}[ ._-]*(?:episodes?|épisodes?|eps?)\\b|\\b(?:episodes?|épisodes?|eps?)[ ._-]*${maxAbsoluteEpisode}\\b`, "i").test(title)) {
    return { start: 1, end: maxAbsoluteEpisode };
  }
  return null;
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
