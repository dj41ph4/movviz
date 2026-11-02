import type { loadSeries } from "@/lib/library/store";

type Series = ReturnType<typeof loadSeries>[number];

/**
 * Card badge for a series. A leftover `activeInfoHash` on an episode that
 * already has its file (a claim never cleared after an import or a discarded
 * replacement) is NOT a download in progress: counting it showed a spinner on
 * ~100 complete series while the engine had a single active torrent.
 */
export function seriesLibraryStatus(series: Series): string {
  const monitored = series.seasons.flatMap((season) => season.episodes).filter((episode) => episode.monitored);
  if (monitored.length === 0) return "missing";
  if (monitored.some((episode) => episode.status === "downloading" || episode.status === "searching" || (episode.activeInfoHash && episode.status !== "available"))) return "downloading";
  if (monitored.every((episode) => episode.status === "upcoming")) return "upcoming";
  return monitored.every((episode) => episode.status === "available" || episode.status === "upcoming") ? "available" : "missing";
}
