/**
 * Bleach keeps TMDb identity 30984, but uses TVDB's aired coordinates for
 * operations (the same coordinates as the original 16 season releases).
 * TMDb's default order is S1=366 original episodes, S2=TYBW. Never identify
 * an episode by a coincident season/episode number from a different order.
 * Source: TMDb episode group 663fb548c10d4be3e80b2f6d (TVDB Order).
 */
import { bleachSeasonContent } from "./bleachSeasonContent";

export const BLEACH_TMDB_ID = 30984;
export const BLEACH_TVDB_ID = 74796;
export const BLEACH_ORIGINAL_COUNTS = [20, 21, 22, 28, 18, 22, 20, 16, 22, 16, 7, 17, 36, 51, 26, 24] as const;
/** Official production parts. Legacy metadata beyond #50 is retained, never acquired blindly. */
export const BLEACH_TYBW_COURS = [
  { part: 1, offset: 0, count: 13 },
  { part: 2, offset: 13, count: 13 },
  { part: 3, offset: 26, count: 14 },
  { part: 4, offset: 40, count: 10 },
] as const;
export function knownBleachEpisode(season: number, episode: number): boolean {
  return Number.isInteger(season) && Number.isInteger(episode) && episode > 0 &&
    (season === 0 || (season === 17 ? episode <= 50 : episode <= (BLEACH_ORIGINAL_COUNTS[season - 1] ?? 0)));
}
export function bleachCourForEpisode(episode: number) {
  return BLEACH_TYBW_COURS.find(c => episode > c.offset && episode <= c.offset + c.count) ?? null;
}
export function bleachNamedCour(title: string): number | null {
  if (/the[ ._-]*blood[ ._-]*warfare/i.test(title)) return 1;
  if (/the[ ._-]*separation|ketsubetsu|訣別/i.test(title)) return 2;
  if (/the[ ._-]*conflict|soukoku|相剋/i.test(title)) return 3;
  if (/the[ ._-]*calamity|kashin|禍進/i.test(title)) return 4;
  return null;
}
export type BleachEpisodeOrder = "tmdb" | "tvdb";
export interface EpisodeCoordinate { seasonNumber: number; episodeNumber: number }
export function isBleachSequelTitle(title: string): boolean {
  return /blood[ ._-]*war|sennen[ ._-]*kessen|\btybw\b|千年血戦/i.test(title)
    || (/bleach|ブリーチ/i.test(title) && (/thousand[ ._-]*year|guerre[ ._-]*(?:sanglante|sanguinaire)/i.test(title) || bleachNamedCour(title) != null));
}

export function bleachToTmdb(seasonNumber: number, episodeNumber: number): EpisodeCoordinate | null {
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  if (seasonNumber === 0) return { seasonNumber: 0, episodeNumber };
  if (seasonNumber === 17) return { seasonNumber: 2, episodeNumber };
  const count = BLEACH_ORIGINAL_COUNTS[seasonNumber - 1];
  if (count == null || episodeNumber > count) return null;
  const offset = BLEACH_ORIGINAL_COUNTS.slice(0, seasonNumber - 1).reduce<number>((n, count) => n + count, 0);
  return { seasonNumber: 1, episodeNumber: offset + episodeNumber };
}

export function bleachFromTmdb(seasonNumber: number, episodeNumber: number): EpisodeCoordinate | null {
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  if (seasonNumber === 0) return { seasonNumber: 0, episodeNumber };
  if (seasonNumber === 2) return { seasonNumber: 17, episodeNumber };
  if (seasonNumber !== 1 || episodeNumber > 366) return null;
  let remaining = episodeNumber;
  for (const [index, count] of BLEACH_ORIGINAL_COUNTS.entries()) {
    if (remaining <= count) return { seasonNumber: index + 1, episodeNumber: remaining };
    remaining -= count;
  }
  return null;
}

export function bleachSeasonSummaries<T extends { seasonNumber: number; name: string; episodeCount: number }>(seasons: T[]): T[] {
  const original = seasons.find((s) => s.seasonNumber === 1);
  const sequel = seasons.find((s) => s.seasonNumber === 2);
  return [
    ...seasons.filter((s) => s.seasonNumber === 0),
    ...(original ? BLEACH_ORIGINAL_COUNTS.map((episodeCount, index) => ({
      ...original, ...bleachSeasonContent(index + 1), seasonNumber: index + 1, name: bleachSeasonContent(index + 1)?.name ?? `Bleach · ${index + 1}`, episodeCount,
      // The aggregate S1 air date is not the premiere of arcs 2–16.
      ...(index > 0 ? { airDate: null } : {}),
    })) : []),
    ...(sequel ? [{ ...sequel, seasonNumber: 17, name: "Bleach: Thousand-Year Blood War" }] : []),
  ];
}

/** Legacy partial imports can be ambiguous. Never guess from S02E01 alone. */
export function detectBleachLibraryOrder(series: {
  tmdbId: number; episodeOrder?: BleachEpisodeOrder;
  seasons: { seasonNumber: number; episodes: { episodeNumber?: number }[] }[];
}): BleachEpisodeOrder | "ambiguous" | null {
  if (series.tmdbId !== BLEACH_TMDB_ID) return null;
  if (series.episodeOrder) return series.episodeOrder;
  // Older TVDB rebuilds wrote the full aired catalogue without the marker.
  // Exact membership of all sixteen arcs proves this is already canonical;
  // a stray S02/S11 or a partial import still proves nothing.
  const original = series.seasons.filter(s => s.seasonNumber >= 1 && s.seasonNumber <= 16);
  if (original.length === 16 && series.seasons.every(s => s.seasonNumber >= 0 && s.seasonNumber <= 17) &&
      BLEACH_ORIGINAL_COUNTS.every((count, index) => {
        const season = original.find(s => s.seasonNumber === index + 1);
        const numbers = new Set(season?.episodes.map(e => e.episodeNumber));
        return season?.episodes.length === count && numbers.size === count &&
          Array.from({ length: count }, (_, i) => i + 1).every(n => numbers.has(n));
      })) return "tvdb";
  if (series.seasons.every(s => s.seasonNumber <= 2) && series.seasons.some((s) => s.seasonNumber === 1 && s.episodes.some((e) => (e.episodeNumber ?? 0) > 20))) return "tmdb";
  return "ambiguous";
}

export function needsBleachRepair(series: Parameters<typeof detectBleachLibraryOrder>[0]): boolean {
  const order = detectBleachLibraryOrder(series);
  return order !== null && order !== "tvdb";
}

/** Standalone TYBW releases restart their part numbering; keep the library S17. */
export function bleachReleaseCoordinate(title: string, seasonNumber: number | null | undefined, episodeNumber: number | null | undefined): EpisodeCoordinate | null {
  if (episodeNumber == null || !Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  const sequel = isBleachSequelTitle(title);
  if (!sequel) return seasonNumber != null ? { seasonNumber, episodeNumber } : null;
  if (seasonNumber === 17) return knownBleachEpisode(17, episodeNumber) ? { seasonNumber: 17, episodeNumber } : null;
  const named = bleachNamedCour(title);
  if (!named && seasonNumber == null && episodeNumber > 13) return knownBleachEpisode(17, episodeNumber) ? { seasonNumber: 17, episodeNumber } : null;
  const cour = BLEACH_TYBW_COURS.find(c => c.part === (named ?? seasonNumber ?? 1));
  if (!cour) return null;
  const cumulative = episodeNumber > cour.offset && episodeNumber <= cour.offset + cour.count;
  const local = episodeNumber <= cour.count;
  if (!cumulative && !local) return null;
  return { seasonNumber: 17, episodeNumber: cumulative ? episodeNumber : cour.offset + episodeNumber };
}

/**
 * Interpret the identity Plex assigns, not the physical content of a file.
 * A stray S11 does NOT prove TVDB order: real Plex libraries can mix orders.
 */
export function projectBleachPlexEpisodes<T extends EpisodeCoordinate>(title: string, episodes: T[], explicitOrder?: string | null, seriesPart?: "original" | "tybw") {
  const items: T[] = [];
  const unresolved: T[] = [];
  for (const episode of episodes) {
    let coordinate: EpisodeCoordinate | null = null;
    if (seriesPart === "tybw" || (!seriesPart && isBleachSequelTitle(title))) coordinate = bleachReleaseCoordinate(seriesPart === "tybw" ? "Bleach TYBW" : title, episode.seasonNumber, episode.episodeNumber);
    else if (explicitOrder === "tmdbAiring") coordinate = bleachFromTmdb(episode.seasonNumber, episode.episodeNumber);
    else if (explicitOrder === "tvdbAiring" || explicitOrder === "aired") coordinate = bleachToTmdb(episode.seasonNumber, episode.episodeNumber) ? episode : null;
    else if (!explicitOrder && (episode.seasonNumber === 0 || (episode.seasonNumber === 1 && episode.episodeNumber >= 1 && episode.episodeNumber <= 20))) coordinate = episode;
    if (coordinate) items.push({ ...episode, ...coordinate });
    else unresolved.push(episode);
  }
  return { items, unresolved, complete: unresolved.length === 0 };
}

/** All-or-nothing adapter for callers that require a complete identity map. */
export function normalizeBleachPlexEpisodes<T extends EpisodeCoordinate>(title: string, episodes: T[], explicitOrder?: string | null): T[] | null {
  const result = projectBleachPlexEpisodes(title, episodes, explicitOrder);
  return result.complete ? result.items : null;
}
