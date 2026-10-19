import { BLEACH_TMDB_ID, BLEACH_ORIGINAL_COUNTS, BLEACH_TYBW_COURS, bleachFromTmdb, bleachToTmdb, bleachSeasonSummaries } from "./bleachEpisodeOrder";
import type { MetaDetail } from "./types";
import { bleachPartArtwork, type BleachArtworkByPart, type BleachArtworkSelection } from "./bleachArtwork";
import { bleachSeasonContent } from "./bleachSeasonContent";
export type BleachPart = "original" | "tybw";
export const BLEACH_COURS = BLEACH_TYBW_COURS.map(c => ({ ...c, title: ["The Blood Warfare", "The Separation", "The Conflict", "The Calamity"][c.part - 1] }));
export function parseBleachPart(value: unknown): BleachPart | undefined { return value === "original" || value === "tybw" ? value : undefined; }
export function bleachCour(episode: number) { return BLEACH_COURS.find(c => episode > c.offset && episode <= c.offset + c.count); }
export function bleachTitleHref(tmdbId: number, type: "movie" | "series", part?: BleachPart) { return `/title/${type}/${tmdbId}${tmdbId === BLEACH_TMDB_ID && type === "series" && part ? `?part=${part}` : ""}`; }
export function bleachPresentationKey(item: { tmdbId: number; type?: string; id?: string; seriesPart?: BleachPart }) { return `${item.type ?? "series"}:${item.id ?? item.tmdbId}${item.seriesPart ? `:${item.seriesPart}` : ""}`; }
export function bleachCanonicalSeasons(part: BleachPart): number[] { return part === "original" ? BLEACH_ORIGINAL_COUNTS.map((_, i) => i + 1) : [17]; }
export function bleachContainsSeason(part: BleachPart, season: number) { return part === "original" ? season >= 0 && season <= 16 : season === 17; }
export function bleachPartTitle(part: BleachPart) { return part === "tybw" ? "Bleach: Thousand-Year Blood War" : "Bleach"; }
export function bleachProjectionPresent(view: { seasons?: { episodes: unknown[] }[] }): boolean { return (view.seasons ?? []).some(s => s.episodes.length > 0); }
export function bleachDisplayToCanonical(part: BleachPart, season: number, episode: number) {
  if (!Number.isInteger(season) || !Number.isInteger(episode) || episode < 1) return null;
  if (part === "original") return season >= 1 && season <= 16 && bleachToTmdb(season, episode) ? { season, episode } : null;
  const cour = BLEACH_COURS.find(c => c.part === season);
  return cour && episode <= cour.count ? { season: 17, episode: cour.offset + episode } : null;
}
export function bleachEpisodeLabel(part: BleachPart | undefined, season: number, episode: number) {
  const cour = part === "tybw" && season === 17 ? bleachCour(episode) : undefined;
  return cour ? `${cour.part}x${String(episode - cour.offset).padStart(2, "0")}` : `${season}x${String(episode).padStart(2, "0")}`;
}
export function projectBleachSearchResults<T extends { tmdbId: number; type: string; title: string; year: number | null }>(results: T[]): (T & { seriesPart?: BleachPart })[] {
  return results.flatMap(item => item.tmdbId === BLEACH_TMDB_ID && item.type === "series" ? (["original", "tybw"] as const).map(seriesPart => ({ ...item, seriesPart, title: bleachPartTitle(seriesPart), year: seriesPart === "tybw" ? 2022 : 2004 })) : [item]);
}
export function projectBleachDetail(detail: MetaDetail, seriesPart: BleachPart): MetaDetail {
  const raw = detail.seasons ?? [];
  const seasons = raw.some(s => s.seasonNumber === 1 && s.episodeCount > 20) && raw.every(s => s.seasonNumber <= 2) ? bleachSeasonSummaries(raw) : raw;
  return { ...detail, seriesPart, title: bleachPartTitle(seriesPart), originalTitle: bleachPartTitle(seriesPart), year: seriesPart === "tybw" ? 2022 : 2004, overview: seriesPart === "tybw" && detail.seriesPart !== "tybw" ? "" : detail.overview, seasons: seasons.filter(s => bleachContainsSeason(seriesPart, s.seasonNumber)).map(s => seriesPart === "original" ? { ...s, ...bleachSeasonContent(s.seasonNumber) } : s) };
}
/** Projection only: IDs and every canonical episode coordinate survive. */
export function projectBleachLibrary<T extends { tmdbId: number; title?: string; year?: number | null; episodeOrder?: string; customBackdropPath?: string | null; customLogoPath?: string | null; bleachArtwork?: BleachArtworkByPart; bleachSettings?: Partial<Record<BleachPart, { qualityProfileId?: string; aliases?: string[] }>>; bleachPlexKeys?: Partial<Record<BleachPart, string | null>>; bleachPlexUrls?: Partial<Record<BleachPart, string | null>>; plexRatingKey?: string | null; plexUrl?: string | null; seasons?: { seasonNumber?: number; name?: string; episodes: { episodeNumber?: number; seasonNumber?: number }[] }[] }>(series: T, seriesPart: BleachPart): T & BleachArtworkSelection & { seriesPart: BleachPart; plexRatingKey?: string | null; plexUrl?: string | null } {
  if (series.tmdbId !== BLEACH_TMDB_ID) return { ...series, seriesPart };
  let seasons = series.seasons ?? [];
  const legacy = series.episodeOrder !== "tvdb" && seasons.every(s => (s.seasonNumber ?? -1) <= 2) && seasons.some(s => s.seasonNumber === 1 && s.episodes.some(e => (e.episodeNumber ?? 0) > 20));
  if (legacy) {
    const grouped = new Map<number, (typeof seasons)[number]>();
    for (const season of seasons) for (const episode of season.episodes) {
      const canonical = bleachFromTmdb(season.seasonNumber ?? -1, episode.episodeNumber ?? -1);
      if (!canonical) continue;
      const next = grouped.get(canonical.seasonNumber) ?? { ...season, seasonNumber: canonical.seasonNumber, episodes: [] };
      next.episodes.push({ ...episode, ...canonical }); grouped.set(canonical.seasonNumber, next);
    }
    seasons = [...grouped.values()];
  }
  return { ...series, ...series.bleachSettings?.[seriesPart], ...bleachPartArtwork(series, seriesPart),
    ...(series.bleachPlexKeys?.[seriesPart] !== undefined ? { plexRatingKey: series.bleachPlexKeys[seriesPart] } : {}),
    ...(series.bleachPlexUrls?.[seriesPart] !== undefined ? { plexUrl: series.bleachPlexUrls[seriesPart] } : {}),
    title: bleachPartTitle(seriesPart), year: seriesPart === "tybw" ? 2022 : 2004, seasons: seasons.filter(s => bleachContainsSeason(seriesPart, s.seasonNumber ?? -1)).map(s => seriesPart === "tybw" ? { ...s, episodes: s.episodes.filter(e => bleachCour(e.episodeNumber ?? -1)) } : s), seriesPart };
}

/** Activity rows (queue, history, wanted) keep Bleach's canonical coordinates in
 * `season`/`episode` (original S1-S16, TYBW as S17 episodes 1-50): the native
 * clients match downloads to episodes with them. The web shows what the fiche
 * shows instead: the standalone TYBW series with its cour × local episode, linking
 * to its own fiche — carried by the additive `display*` fields. */
export function presentBleachActivityMedia<T extends { type: string; tmdbId?: number; title: string; season?: number; episode?: number; packEpisodeCount?: number; href: string; displayTitle?: string; displayLabel?: string; displaySeason?: number | null; displayEpisode?: number | null }>(media: T): T {
  if (media.tmdbId !== BLEACH_TMDB_ID || media.type !== "series" || media.season == null || media.season < 1) return media;
  if (media.season !== 17) return { ...media, href: bleachTitleHref(BLEACH_TMDB_ID, "series", "original") };
  const href = bleachTitleHref(BLEACH_TMDB_ID, "series", "tybw");
  const displayTitle = bleachPartTitle("tybw");
  const cour = media.episode != null ? bleachCour(media.episode) : undefined;
  // A single episode shows its cour and local number; a pack spanning cours
  // shows the series alone.
  if (!media.packEpisodeCount && cour) return { ...media, displayTitle, href, displaySeason: cour.part, displayEpisode: media.episode! - cour.offset, displayLabel: `S${cour.part} · E${media.episode! - cour.offset}` };
  return { ...media, displayTitle, href, displaySeason: null, displayEpisode: null, displayLabel: "" };
}
