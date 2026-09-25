import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import type { AiPlayTarget } from "./types";

// « lance-le », « démarre-le », « joue le film », « lance la lecture »,
// « mets-le » (but not « mets-le en vu », the seen command, handled first).
const PLAY_WITH_OBJECT_RE = /\b(?:lance[sz]?|lancer|d[ée]marre[sz]?|d[ée]marrer|joue[sz]?|jouer|mets|mettre)[- ](?:le|la|les|l['’])(?:\s*(?:film|s[ée]rie|[ée]pisode|lecture|suivant|prochain))?\b(?!\s+(?:en|dans|comme|à|a|de|du|sur)\b)/i;
// « lance », « vas-y lance », « ok démarre », « play » — an order on its own.
const PLAY_ALONE_RE = /^[\s,.!]*(?:(?:ouais|oui|ok|okay|vas[- ]y|allez|go|bon|alors)[\s,.!]+)*(?:lance|d[ée]marre|joue|play)[\s,.!]*$/i;

export function isPlayRequest(message: string): boolean {
  return PLAY_WITH_OBJECT_RE.test(message) || PLAY_ALONE_RE.test(message.trim());
}

/**
 * What « lance-le » plays for this user: the film itself, or for a series
 * the episode they are in the middle of, else the first one not yet seen —
 * always one with a file (Movviz or Plex). Null when the title is not
 * playable from the library.
 */
export function resolvePlayTarget(userId: string, subject: { tmdbId: number; type: "movie" | "series" }): AiPlayTarget | null {
  if (subject.type === "movie") {
    const movie = getMovieByTmdbId(subject.tmdbId);
    if (!movie || (!movie.file && !movie.plexRatingKey)) return null;
    return {
      type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath,
      ratingKey: movie.plexRatingKey ?? movie.id, movvizId: movie.id,
    };
  }
  const series = getSeriesByTmdbId(subject.tmdbId);
  if (!series) return null;
  const playable = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((season) => [...season.episodes]
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .filter((ep) => ep.file || ep.plexRatingKey)
      .map((ep) => ({ season: season.seasonNumber, ep })));
  if (!playable.length) return null;
  const inProgress = listPlaybackProgress(userId)
    .filter((p) => p.mediaType === "episode" && p.tmdbId === series.tmdbId)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))[0];
  const watched = new Set((getWatchStatus(userId)?.episodes ?? [])
    .filter((e) => e.tmdbId === series.tmdbId)
    .map((e) => `${e.season}:${e.episode}`));
  const pick = (inProgress && playable.find((x) => x.season === inProgress.seasonNumber && x.ep.episodeNumber === inProgress.episodeNumber))
    ?? playable.find((x) => !watched.has(`${x.season}:${x.ep.episodeNumber}`))
    ?? playable[0];
  const movvizId = `${series.id}:s${pick.season}e${pick.ep.episodeNumber}`;
  return {
    type: "series", tmdbId: series.tmdbId, title: series.title, posterPath: series.posterPath,
    ratingKey: pick.ep.plexRatingKey ?? movvizId, movvizId, seriesId: series.id,
    seasonNumber: pick.season, episodeNumber: pick.ep.episodeNumber, episodeTitle: pick.ep.title || undefined,
  };
}
