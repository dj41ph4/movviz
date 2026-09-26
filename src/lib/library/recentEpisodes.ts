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
