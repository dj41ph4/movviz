import { loadPlexConfig } from "./store";
import { batchTmdbIds, buildPlexWebUrl } from "./client";
import { getVerifiedOnDeck, resolvePlexServerAuth } from "./watchWrite";
import { isEarlierEpisode } from "./onDeckPolicy";
import { getMovieByPlexRatingKey, findEpisodeByPlexLocator } from "@/lib/library/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { completionBoundaryMs } from "@/lib/playback/progressPolicy";
import { getMovie, getSeason, getSeries } from "@/lib/metadata/tmdb";
import type { DashboardFileTechnical } from "@/lib/dashboard/interfaceTypes";
import type { User } from "@/lib/auth/types";

/** Vrai si offsetMs est déjà assez proche de la fin de durationMs pour
 *  compter comme « terminé » — même règle pour toute source de progression
 *  (Movviz local ou Plex on-deck), jamais deux seuils différents. Sans repère
 *  « générique » par item (coûterait un appel Plex par entrée de la liste),
 *  retombe sur le même seuil de repli que le lecteur lui-même : 5 min pour
 *  un film, 2 min pour un épisode, 10 % pour un média court. */
function isNearEnd(offsetMs: number, durationMs: number, type: "movie" | "episode"): boolean {
  const { boundaryMs } = completionBoundaryMs(durationMs, [], type);
  return boundaryMs != null && offsetMs >= boundaryMs;
}

export interface OnDeckEntry {
  type: "movie" | "episode";
  tmdbId: number; title: string; posterPath: string | null; year: number | null; rating: number;
  progressPercent: number; offsetMs: number; seasonNumber?: number; episodeNumber?: number;
  episodeTitle?: string; plexRatingKey: string | null; plexUrl: string | null; movvizId?: string;
  /** Vignette 16:9 de l'épisode. Elle reste distincte de l'affiche de la
   * série : les clients NX l'emploient uniquement pour une reprise épisode. */
  episodeStillPath?: string | null;
  seriesId?: string; technical?: DashboardFileTechnical;
  /** One clock for Movviz and Plex. Consumers sort this descending. */
  lastPlayedAt: number;
}

const EPISODE_STILL_TTL_MS = 6 * 60 * 60 * 1000;
type EpisodeStillCache = Map<string, { value: string | null; expiresAt: number }>;

/** TMDb ne change pas la vignette d'un épisode publié. Un cache partagé évite
 * de refaire une requête saison à chaque polling de « Continuer à regarder ». */
function episodeStillCache(): EpisodeStillCache {
  const root = globalThis as typeof globalThis & { __movvizOnDeckEpisodeStills?: EpisodeStillCache };
  return root.__movvizOnDeckEpisodeStills ??= new Map();
}

async function resolveEpisodeStillPath(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<string | null> {
  const key = `${tmdbId}:s${seasonNumber}:e${episodeNumber}`;
  const cache = episodeStillCache();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const season = await getSeason(tmdbId, seasonNumber);
  const value = season?.episodes.find((episode) => episode.episodeNumber === episodeNumber)?.stillPath ?? null;
  cache.set(key, { value, expiresAt: Date.now() + EPISODE_STILL_TTL_MS });
  return value;
}

async function attachEpisodeStills(items: OnDeckEntry[]): Promise<OnDeckEntry[]> {
  const episodes = items.filter((item): item is OnDeckEntry & { type: "episode"; seasonNumber: number; episodeNumber: number } =>
    item.type === "episode" && item.seasonNumber != null && item.episodeNumber != null,
  );
  await Promise.all(episodes.map(async (item) => {
    item.episodeStillPath = await resolveEpisodeStillPath(item.tmdbId, item.seasonNumber, item.episodeNumber);
  }));
  return items;
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
      if (isNearEnd(p.resumeOffsetMs, p.durationMs, "movie")) continue;
      const key = movie.plexRatingKey ?? p.ratingKey;
      items.push({ type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, year: movie.year, rating: movie.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: movie.id, technical: technical(movie.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
      continue;
    }
    const found = findEpisodeByPlexLocator(p.ratingKey);
    if (!found) continue;
    if (isNearEnd(p.resumeOffsetMs, p.durationMs, "episode")) continue;
    const key = found.episode.plexRatingKey ?? p.ratingKey;
    items.push({ type: "episode", tmdbId: found.series.tmdbId, title: found.series.title, posterPath: found.series.posterPath, year: found.series.year, rating: found.series.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, seasonNumber: found.season.seasonNumber, episodeNumber: found.episode.episodeNumber, episodeTitle: found.episode.title, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: `${found.series.id}:s${found.season.seasonNumber}e${found.episode.episodeNumber}`, seriesId: found.series.id, technical: technical(found.episode.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
  }
  if (!cfg.hostname) return (await attachEpisodeStills(items)).sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);

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
    if (!d.duration || (d.type === "movie" && d.viewOffset <= 0) || isNearEnd(d.viewOffset, d.duration, d.type)) continue;
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
  return (await attachEpisodeStills([...newest.values()])).sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);
}
