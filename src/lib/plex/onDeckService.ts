import { loadPlexConfig } from "./store";
import { batchTmdbIds, buildPlexWebUrl } from "./client";
import { getVerifiedOnDeck, resolvePlexServerAuth } from "./watchWrite";
import { isEarlierEpisode } from "./onDeckPolicy";
import { getMovieByPlexRatingKey, findEpisodeByPlexLocator } from "@/lib/library/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { getMovie, getSeries } from "@/lib/metadata/tmdb";
import type { DashboardFileTechnical } from "@/lib/dashboard/interfaceTypes";
import type { User } from "@/lib/auth/types";

export interface OnDeckEntry {
  type: "movie" | "episode";
  tmdbId: number; title: string; posterPath: string | null; year: number | null; rating: number;
  progressPercent: number; offsetMs: number; seasonNumber?: number; episodeNumber?: number;
  episodeTitle?: string; plexRatingKey: string | null; plexUrl: string | null; movvizId?: string;
  seriesId?: string; technical?: DashboardFileTechnical;
  /** One clock for Movviz and Plex. Consumers sort this descending. */
  lastPlayedAt: number;
}

function technical(file: { resolution: string | null; videoCodec: string | null; audioCodec: string | null; hdr: string | null } | null): DashboardFileTechnical | undefined {
  return file ? { resolution: file.resolution, videoCodec: file.videoCodec, audioCodec: file.audioCodec, hdr: file.hdr } : undefined;
}

/** Single per-user Continue Watching source. Plex enriches it when available. */
export async function listOnDeckEntries(user: User): Promise<OnDeckEntry[]> {
  const cfg = loadPlexConfig();
  const local = listPlaybackProgress(user.id);
  const items: OnDeckEntry[] = [];
  const plexUrlFor = (key: string | null) => key && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, key) : null;
  for (const p of local) {
    if (!p.resumeOffsetMs || !p.durationMs) continue;
    const movie = getMovieByPlexRatingKey(p.ratingKey);
    if (movie) {
      const key = movie.plexRatingKey ?? p.ratingKey;
      items.push({ type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, year: movie.year, rating: movie.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: movie.id, technical: technical(movie.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
      continue;
    }
    const found = findEpisodeByPlexLocator(p.ratingKey);
    if (!found) continue;
    const key = found.episode.plexRatingKey ?? p.ratingKey;
    items.push({ type: "episode", tmdbId: found.series.tmdbId, title: found.series.title, posterPath: found.series.posterPath, year: found.series.year, rating: found.series.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, seasonNumber: found.season.seasonNumber, episodeNumber: found.episode.episodeNumber, episodeTitle: found.episode.title, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: `${found.series.id}:s${found.season.seasonNumber}e${found.episode.episodeNumber}`, seriesId: found.series.id, technical: technical(found.episode.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
  }
  if (!cfg.hostname) return items.sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);

  const onDeck = await getVerifiedOnDeck(user, cfg);
  // Plex is an optional peer, not a subset of the Movviz library. Resolve
  // external IDs directly from Plex so a perfectly valid Plex resume is not
  // silently dropped merely because the title was never added to Movviz.
  const auth = await resolvePlexServerAuth(user, cfg);
  const metadataByKey = auth
    ? await batchTmdbIds(cfg, auth.token, onDeck.flatMap((item) => item.type === "episode" && item.grandparentRatingKey ? [item.ratingKey, item.grandparentRatingKey] : [item.ratingKey]))
    : new Map<string, { tmdbId: number | null }>();
  const movieMeta = new Map<number, ReturnType<typeof getMovie>>();
  const seriesMeta = new Map<number, ReturnType<typeof getSeries>>();
  const resolveMovieMeta = (tmdbId: number) => movieMeta.get(tmdbId) ?? movieMeta.set(tmdbId, getMovie(tmdbId)).get(tmdbId)!;
  const resolveSeriesMeta = (tmdbId: number) => seriesMeta.get(tmdbId) ?? seriesMeta.set(tmdbId, getSeries(tmdbId)).get(tmdbId)!;
  const firstBySeries = new Map<number, { season: number; episode: number }>();
  for (const d of onDeck) {
    if (d.type !== "episode" || d.viewOffset > 0 || !d.duration) continue;
    const found = findEpisodeByPlexLocator(d.ratingKey, d.grandparentRatingKey, d.seasonNumber, d.episodeNumber);
    const tmdbId = found?.series.tmdbId ?? (d.grandparentRatingKey ? metadataByKey.get(d.grandparentRatingKey)?.tmdbId : null);
    const season = found?.season.seasonNumber ?? d.seasonNumber;
    const episode = found?.episode.episodeNumber ?? d.episodeNumber;
    if (tmdbId == null || season == null || episode == null) continue;
    const c = { tmdbId, season, episode };
    // Plex /library/onDeck is already the per-profile continuation source.
    // Do not require a prior asynchronous history import here: that made a
    // finished S04 disappear instead of exposing Plex's S05E01 immediately.
    const first = firstBySeries.get(c.tmdbId); if (!first || isEarlierEpisode(c, first)) firstBySeries.set(c.tmdbId, c);
  }
  for (const d of onDeck) {
    if (!d.duration || (d.type === "movie" && d.viewOffset <= 0)) continue;
    const percent = Math.min(100, Math.round(d.viewOffset / d.duration * 100));
    if (d.type === "movie") {
      const movie = getMovieByPlexRatingKey(d.ratingKey);
      const tmdbId = movie?.tmdbId ?? metadataByKey.get(d.ratingKey)?.tmdbId;
      if (tmdbId == null) continue;
      const meta = movie ? null : await resolveMovieMeta(tmdbId);
      if (!movie && !meta) continue;
      const key = movie?.plexRatingKey ?? d.ratingKey;
      items.push({ type: "movie", tmdbId, title: movie?.title ?? meta!.title, posterPath: movie?.posterPath ?? meta!.posterPath, year: movie?.year ?? meta!.year, rating: movie?.rating ?? meta!.rating, progressPercent: percent, offsetMs: d.viewOffset, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: movie?.id, technical: technical(movie?.file ?? null), lastPlayedAt: d.lastViewedAt ?? d.updatedAt ?? 0 });
      continue;
    }
    const found = findEpisodeByPlexLocator(d.ratingKey, d.grandparentRatingKey, d.seasonNumber, d.episodeNumber);
    const tmdbId = found?.series.tmdbId ?? (d.grandparentRatingKey ? metadataByKey.get(d.grandparentRatingKey)?.tmdbId : null);
    const season = found?.season.seasonNumber ?? d.seasonNumber;
    const episode = found?.episode.episodeNumber ?? d.episodeNumber;
    if (tmdbId == null || season == null || episode == null) continue;
    const c = { tmdbId, season, episode };
    const first = firstBySeries.get(c.tmdbId);
    if (d.viewOffset <= 0 && (first?.season !== c.season || first?.episode !== c.episode)) continue;
    const meta = found ? null : await resolveSeriesMeta(tmdbId);
    if (!found && !meta) continue;
    const key = found?.episode.plexRatingKey ?? d.ratingKey;
    items.push({ type: "episode", tmdbId, title: found?.series.title ?? meta!.title, posterPath: found?.series.posterPath ?? meta!.posterPath, year: found?.series.year ?? meta!.year, rating: found?.series.rating ?? meta!.rating, progressPercent: percent, offsetMs: d.viewOffset, seasonNumber: season, episodeNumber: episode, episodeTitle: found?.episode.title, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: found ? `${found.series.id}:s${season}e${episode}` : undefined, seriesId: found?.series.id, technical: technical(found?.episode.file ?? null), lastPlayedAt: d.lastViewedAt ?? d.updatedAt ?? 0 });
  }
  // Exactly one current action per logical media. The most recently updated
  // peer wins — position size never decides a conflict.
  const newest = new Map<string, OnDeckEntry>();
  for (const item of items) {
    const identity = item.type === "movie" ? `movie:${item.tmdbId}` : `episode:${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
    const current = newest.get(identity);
    if (!current || item.lastPlayedAt > current.lastPlayedAt) newest.set(identity, item);
  }
  return [...newest.values()].sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);
}
