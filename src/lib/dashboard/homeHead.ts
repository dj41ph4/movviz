import type { DashboardInterfaceData } from "./interfaceTypes";
import { selectRecentlyAdded } from "./recentlyAdded";

/** Same count as the "recently added" rows of the TV and mobile home screens. */
const HEAD_COUNT = 20;

export type DashboardHomeHead = Pick<DashboardInterfaceData, "movies" | "series" | "recentEpisodes" | "recentEpisodesNextCursor">;

/**
 * The few titles the first rows of the Android home screens actually show, so
 * they can be painted before the full library (2 MB) has been transferred and
 * decoded. Series with a recent episode are always included: those rows drop
 * any arrival whose series is unknown to the client.
 */
export function selectDashboardHomeHead(payload: DashboardInterfaceData): DashboardHomeHead {
  const movies = payload.movies
    .filter((movie) => movie.status === "available")
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, HEAD_COUNT);
  const newest = new Set(selectRecentlyAdded([], payload.series, HEAD_COUNT).map(({ item }) => item));
  const withRecentEpisode = new Set(payload.recentEpisodes.map((episode) => episode.tmdbId));
  return {
    movies,
    series: payload.series.filter((show) => newest.has(show) || withRecentEpisode.has(show.tmdbId)),
    recentEpisodes: payload.recentEpisodes,
    recentEpisodesNextCursor: payload.recentEpisodesNextCursor,
  };
}
