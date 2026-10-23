import type { DashboardLibrarySeries, DashboardRecentEpisode } from "../dashboard/interfaceTypes";
import type { WatchedEpisode } from "../plex/watchStore";
import { BLEACH_TMDB_ID } from "../metadata/bleachEpisodeOrder";
import { bleachCour, bleachPartTitle, type BleachPart } from "../metadata/bleachPresentation";

/**
 * « Recently added » episodes for the home screens, newest first.
 *
 * A plain « 24 newest » let one bulk arrival fill the whole list: Regular Show
 * gaining a full season at once was all Android TV had left to group, so its
 * « Ajouts récents » row showed that single series and nothing else. The list
 * now goes on until it covers enough different series (the TV groups it per
 * series), within a hard cap. Rows showing every episode keep their own limit.
 */
export const RECENT_EPISODE_SERIES = 20;
export const RECENT_EPISODE_MAX = 150;

/** Page by series, not by file: a season import must never consume the whole
 * first page. Two files per series are enough for clients to distinguish a
 * single arrival from a batch; the library supplies the full season count. */
export function recentEpisodePage<T extends { tmdbId: number; addedAt: number; seasonNumber: number }>(
  episodes: T[], cursor = 0, pageSize = RECENT_EPISODE_SERIES,
): { episodes: T[]; nextCursor: number | null } {
  const groups = new Map<string, T[]>();
  for (const episode of episodes) {
    const part = episode.tmdbId === BLEACH_TMDB_ID && episode.seasonNumber === 17 ? "tybw" : "original";
    const key = `${episode.tmdbId}:${part}`;
    const group = groups.get(key) ?? [];
    group.push(episode);
    groups.set(key, group);
  }
  const ordered = [...groups.values()]
    .map((group) => group.sort((a, b) => b.addedAt - a.addedAt))
    .sort((a, b) => b[0].addedAt - a[0].addedAt);
  const start = Math.max(0, cursor);
  const page = ordered.slice(start, start + pageSize);
  return {
    episodes: page.flatMap((group) => group.slice(0, 2)),
    nextCursor: start + page.length < ordered.length ? start + page.length : null,
  };
}

export function recentEpisodesAcrossSeries<T extends { tmdbId: number; addedAt: number }>(
  episodes: T[],
  seriesWanted = RECENT_EPISODE_SERIES,
  max = RECENT_EPISODE_MAX,
): T[] {
  const sorted = [...episodes].sort((a, b) => b.addedAt - a.addedAt);
  const out: T[] = [];
  const series = new Set<number>();
  for (const episode of sorted) {
    if (out.length >= max) break;
    if (!series.has(episode.tmdbId)) {
      if (series.size >= seriesWanted) break;
      series.add(episode.tmdbId);
    }
    out.push(episode);
  }
  return out;
}

export interface RecentEpisodeGroup {
  key: string;
  latest: DashboardRecentEpisode;
  seriesPart?: BleachPart;
  displaySeason: number;
  displayEpisode: number;
  grouped: boolean;
  unwatchedCount: number | null;
  fullyWatched: boolean;
}

/** Mirrors Android TV: one card per series/part, showing the latest season
 * when several episodes arrived. Count the whole available season when known,
 * falling back to the recent files, and keep each user's watched state separate.
 * Apply the row limit after grouping so bulk imports cannot hide other shows. */
export function groupRecentEpisodes(
  episodes: DashboardRecentEpisode[],
  watched: WatchedEpisode[],
  series: DashboardLibrarySeries[],
): RecentEpisodeGroup[] {
  const groups = new Map<string, DashboardRecentEpisode[]>();
  for (const episode of episodes) {
    const part = episode.tmdbId === BLEACH_TMDB_ID ? (episode.seasonNumber === 17 ? "tybw" : "original") : "";
    const key = `${episode.tmdbId}:${part}`;
    const group = groups.get(key) ?? [];
    group.push(episode);
    groups.set(key, group);
  }
  const seen = new Set(watched.map((ep) => `${ep.tmdbId}:${ep.season}:${ep.episode}`));
  const bySeries = new Map(series.map((show) => [show.tmdbId, show]));
  return [...groups].map(([key, group]): RecentEpisodeGroup => {
    const latest = group.reduce((a, b) => b.addedAt > a.addedAt ? b : a);
    const seriesPart = latest.tmdbId === BLEACH_TMDB_ID ? (latest.seasonNumber === 17 ? "tybw" : "original") : undefined;
    const cour = seriesPart === "tybw" ? bleachCour(latest.episodeNumber) : undefined;
    const grouped = group.length > 1;
    const seasonTotal = bySeries.get(latest.tmdbId)?.availableBySeason?.[latest.seasonNumber];
    const watchedInSeason = [...seen].filter((id) => id.startsWith(`${latest.tmdbId}:${latest.seasonNumber}:`)).length;
    const remaining = seasonTotal != null
      ? Math.max(0, seasonTotal - watchedInSeason)
      : group.filter((ep) => ep.seasonNumber === latest.seasonNumber && !seen.has(`${ep.tmdbId}:${ep.seasonNumber}:${ep.episodeNumber}`)).length;
    return {
      key,
      latest: seriesPart ? { ...latest, title: bleachPartTitle(seriesPart) } : latest,
      seriesPart,
      displaySeason: cour?.part ?? latest.seasonNumber,
      displayEpisode: latest.episodeNumber - (cour?.offset ?? 0),
      grouped,
      unwatchedCount: grouped && remaining > 0 ? remaining : null,
      fullyWatched: grouped ? remaining === 0 : seen.has(`${latest.tmdbId}:${latest.seasonNumber}:${latest.episodeNumber}`),
    };
  }).sort((a, b) => b.latest.addedAt - a.latest.addedAt);
}
