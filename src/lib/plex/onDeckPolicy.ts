import type { WatchStatus } from "./watchStore";

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
