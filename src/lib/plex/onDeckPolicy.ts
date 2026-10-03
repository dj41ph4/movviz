import type { WatchStatus } from "./watchStore";
import type { LibraryEpisode, LibrarySeason } from "@/lib/library/types";

export function hasEpisodeSource(episode: Pick<LibraryEpisode, "file" | "plexRatingKey">): boolean {
  return !!(episode.file || episode.plexRatingKey);
}

/** Never manufacture a successor, or skip the first unwatched missing item. */
export function nextAvailableEpisode(
  seasons: LibrarySeason[],
  isWatched: (season: number, episode: number) => boolean,
) {
  const next = [...seasons].filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((season) => [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
      .map((episode) => ({ season, episode })))
    .find(({ season, episode }) => !isWatched(season.seasonNumber, episode.episodeNumber));
  return next && hasEpisodeSource(next.episode) ? next : null;
}

export function availableEpisode(seasons: LibrarySeason[], seasonNumber: number, episodeNumber: number) {
  const season = seasons.find((item) => item.seasonNumber === seasonNumber);
  const episode = season?.episodes.find((item) => item.episodeNumber === episodeNumber);
  return season && episode && hasEpisodeSource(episode) ? { season, episode } : null;
}

/**
 * Plex emits a zero-offset On Deck entry for the next unwatched episode.
 * Accept it only after this particular user has watched an earlier episode
 * of the same series; otherwise the item is a never-started suggestion, not
 * a continuation.
 */
export function isNextUnwatchedEpisode(
  candidate: { tmdbId: number; season: number; episode: number },
  watched: Pick<WatchStatus, "episodes"> | null,
): boolean {
  const seen = (watched?.episodes ?? []).filter((entry) => entry.tmdbId === candidate.tmdbId);
  if (seen.some((entry) => entry.season === candidate.season && entry.episode === candidate.episode)) return false;
  return seen.some((entry) =>
    entry.season < candidate.season ||
    (entry.season === candidate.season && entry.episode < candidate.episode)
  );
}

export function isEarlierEpisode(
  left: { season: number; episode: number },
  right: { season: number; episode: number },
): boolean {
  return left.season < right.season || (left.season === right.season && left.episode < right.episode);
}
