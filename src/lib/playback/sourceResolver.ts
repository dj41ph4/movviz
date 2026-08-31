import fs from "node:fs";
import path from "node:path";
import { getMovie, loadMovies, loadSeries } from "@/lib/library/store";
import { getPrimaryFile } from "@/lib/library/versions";
import { offlineInstancesSnapshot } from "@/lib/engine/stateFile";
import type { LibraryEpisode, LibraryMovie } from "@/lib/library/types";

export type PlaybackSource = {
  source: "movviz" | "plex";
  movvizId: string;
  path: string | null;
  plexRatingKey: string | null;
};

export type PlaybackResolution =
  | { ok: true; value: PlaybackSource }
  | { ok: false; code: "not_found" | "not_playable" };

function isInsideRoot(file: string, root: string): boolean {
  const resolved = path.resolve(file);
  const base = path.resolve(root);
  const relative = path.relative(base, resolved);
  return relative !== "" && relative !== "." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function allowedRoots(): string[] {
  return offlineInstancesSnapshot().map((instance) => instance.completedPath).filter(Boolean).map((root) => path.resolve(root));
}

function validLocalFile(file: string | null | undefined): file is string {
  if (!file || !path.isAbsolute(file)) return false;
  if (!allowedRoots().some((root) => isInsideRoot(file, root))) return false;
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function fromMovie(movie: LibraryMovie): PlaybackResolution {
  const localPath = movie.file?.diskPath ?? movie.file?.path;
  if (validLocalFile(localPath)) {
    return { ok: true, value: { source: "movviz", movvizId: movie.id, path: localPath, plexRatingKey: movie.plexRatingKey } };
  }
  if (movie.plexRatingKey) {
    return { ok: true, value: { source: "plex", movvizId: movie.id, path: null, plexRatingKey: movie.plexRatingKey } };
  }
  return { ok: false, code: "not_playable" };
}

function fromEpisode(seriesId: string, episode: LibraryEpisode): PlaybackResolution {
  const localPath = episode.file?.diskPath ?? episode.file?.path;
  if (validLocalFile(localPath)) {
    return { ok: true, value: { source: "movviz", movvizId: `${seriesId}:s${episode.seasonNumber}e${episode.episodeNumber}`, path: localPath, plexRatingKey: episode.plexRatingKey } };
  }
  if (episode.plexRatingKey) {
    return { ok: true, value: { source: "plex", movvizId: `${seriesId}:s${episode.seasonNumber}e${episode.episodeNumber}`, path: null, plexRatingKey: episode.plexRatingKey } };
  }
  return { ok: false, code: "not_playable" };
}

export function resolveMoviePlayback(movvizId: string): PlaybackResolution {
  const movie = getMovie(movvizId);
  return movie ? fromMovie(movie) : { ok: false, code: "not_found" };
}

export function resolveEpisodePlayback(seriesId: string, seasonNumber: number, episodeNumber: number): PlaybackResolution {
  const series = loadSeries().find((item) => item.id === seriesId);
  const episode = series?.seasons.find((season) => season.seasonNumber === seasonNumber)?.episodes.find((item) => item.episodeNumber === episodeNumber);
  return episode ? fromEpisode(seriesId, episode) : { ok: false, code: "not_found" };
}

/** Matches the `${seriesId}:s{season}e{episode}` mediaId shape VideoPlayer.tsx
 *  already builds for episodes (see its own inferredSeriesId regex) — a plain
 *  movie movvizId never contains a colon, so this never false-positives. */
const EPISODE_MEDIA_ID_RE = /^(.+):s(\d+)e(\d+)$/;

export type LocalFileResolution = { ok: true; path: string } | { ok: false; code: "not_found" | "not_playable" };

/**
 * Movie OR episode mediaId → its real local file path, for the engine
 * (decidePlayback/localExecutor) that can only ever operate on an actual
 * file on disk — never on a Plex-only-linked title. Shared by
 * /api/playback/prepare and /api/playback/session/[id]/stream so the two
 * routes can never drift on how a mediaId resolves to a file (they used to
 * each inline the movie-only version of this lookup separately).
 */
export function resolveLocalFilePath(mediaId: string): LocalFileResolution {
  const episodeMatch = EPISODE_MEDIA_ID_RE.exec(mediaId);
  if (episodeMatch) {
    const [, seriesId, seasonStr, episodeStr] = episodeMatch;
    const resolved = resolveEpisodePlayback(seriesId, Number(seasonStr), Number(episodeStr));
    if (!resolved.ok) return resolved;
    if (resolved.value.source !== "movviz" || !resolved.value.path) return { ok: false, code: "not_playable" };
    return { ok: true, path: resolved.value.path };
  }
  const movie = getMovie(mediaId);
  if (!movie) return { ok: false, code: "not_found" };
  const file = getPrimaryFile(movie);
  const filePath = file?.diskPath ?? file?.path;
  if (!filePath) return { ok: false, code: "not_playable" };
  return { ok: true, path: filePath };
}

export function resolveByPlexRatingKey(ratingKey: string): PlaybackResolution {
  const movie = loadMovies().find((item) => item.plexRatingKey === ratingKey);
  if (movie) return fromMovie(movie);
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      const episode = season.episodes.find((item) => item.plexRatingKey === ratingKey);
      if (episode) return fromEpisode(series.id, episode);
    }
  }
  return { ok: false, code: "not_found" };
}
