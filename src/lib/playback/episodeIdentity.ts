import { findEpisodeByPlexLocator, getSeries } from "@/lib/library/store";

/** Recover coordinates from old Android sessions and local playback keys. */
export function resolvePlaybackEpisode(ratingKey: string, mediaId?: string) {
  const match = /^(.*):s(\d+)e(\d+)$/.exec(mediaId ?? ratingKey);
  if (match) {
    const series = getSeries(match[1]);
    const season = series?.seasons.find((s) => s.seasonNumber === Number(match[2]));
    const episode = season?.episodes.find((e) => e.episodeNumber === Number(match[3]));
    if (series && season && episode) return { series, season, episode };
  }
  return findEpisodeByPlexLocator(ratingKey);
}
