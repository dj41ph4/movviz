import { loadPlexConfig } from "./store";
import { buildPlexWebUrl } from "./client";
import { getVerifiedOnDeck } from "./watchWrite";
import { isEarlierEpisode } from "./onDeckPolicy";
import { getMovieByPlexRatingKey, findEpisodeByPlexLocator } from "@/lib/library/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
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
  const localKeys = new Set<string>();
  const localSeries = new Set<number>();
  const plexUrlFor = (key: string | null) => key && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, key) : null;
  for (const p of local) {
    if (!p.resumeOffsetMs || !p.durationMs) continue;
    const movie = getMovieByPlexRatingKey(p.ratingKey);
    if (movie) {
      localKeys.add(p.ratingKey); const key = movie.plexRatingKey ?? p.ratingKey;
      items.push({ type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, year: movie.year, rating: movie.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: movie.id, technical: technical(movie.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
      continue;
    }
    const found = findEpisodeByPlexLocator(p.ratingKey);
    if (!found) continue;
    localKeys.add(p.ratingKey); localSeries.add(found.series.tmdbId); const key = found.episode.plexRatingKey ?? p.ratingKey;
    items.push({ type: "episode", tmdbId: found.series.tmdbId, title: found.series.title, posterPath: found.series.posterPath, year: found.series.year, rating: found.series.rating, progressPercent: Math.min(100, Math.round(p.resumeOffsetMs / p.durationMs * 100)), offsetMs: p.resumeOffsetMs, seasonNumber: found.season.seasonNumber, episodeNumber: found.episode.episodeNumber, episodeTitle: found.episode.title, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: `${found.series.id}:s${found.season.seasonNumber}e${found.episode.episodeNumber}`, seriesId: found.series.id, technical: technical(found.episode.file), lastPlayedAt: p.lastPlayedAt ?? p.updatedAt });
  }
  if (!cfg.hostname) return items.sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);

  const onDeck = await getVerifiedOnDeck(user, cfg);
  const firstBySeries = new Map<number, { season: number; episode: number }>();
  for (const d of onDeck) {
    if (d.type !== "episode" || d.viewOffset > 0 || !d.duration || localKeys.has(d.ratingKey)) continue;
    const found = findEpisodeByPlexLocator(d.ratingKey, d.grandparentRatingKey, d.seasonNumber, d.episodeNumber);
    if (!found || localSeries.has(found.series.tmdbId)) continue;
    const c = { tmdbId: found.series.tmdbId, season: found.season.seasonNumber, episode: found.episode.episodeNumber };
    // Plex /library/onDeck is already the per-profile continuation source.
    // Do not require a prior asynchronous history import here: that made a
    // finished S04 disappear instead of exposing Plex's S05E01 immediately.
    const first = firstBySeries.get(c.tmdbId); if (!first || isEarlierEpisode(c, first)) firstBySeries.set(c.tmdbId, c);
  }
  for (const d of onDeck) {
    if (!d.duration || localKeys.has(d.ratingKey) || (d.type === "movie" && d.viewOffset <= 0)) continue;
    const percent = Math.min(100, Math.round(d.viewOffset / d.duration * 100));
    if (d.type === "movie") {
      const movie = getMovieByPlexRatingKey(d.ratingKey); if (!movie) continue; const key = movie.plexRatingKey ?? d.ratingKey;
      items.push({ type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, year: movie.year, rating: movie.rating, progressPercent: percent, offsetMs: d.viewOffset, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: movie.id, technical: technical(movie.file), lastPlayedAt: d.lastViewedAt ?? d.updatedAt ?? 0 });
      continue;
    }
    const found = findEpisodeByPlexLocator(d.ratingKey, d.grandparentRatingKey, d.seasonNumber, d.episodeNumber); if (!found) continue;
    const c = { tmdbId: found.series.tmdbId, season: found.season.seasonNumber, episode: found.episode.episodeNumber };
    const first = firstBySeries.get(c.tmdbId);
    if (d.viewOffset <= 0 && (localSeries.has(c.tmdbId) || first?.season !== c.season || first?.episode !== c.episode)) continue;
    const key = found.episode.plexRatingKey ?? d.ratingKey;
    items.push({ type: "episode", tmdbId: found.series.tmdbId, title: found.series.title, posterPath: found.series.posterPath, year: found.series.year, rating: found.series.rating, progressPercent: percent, offsetMs: d.viewOffset, seasonNumber: found.season.seasonNumber, episodeNumber: found.episode.episodeNumber, episodeTitle: found.episode.title, plexRatingKey: key, plexUrl: plexUrlFor(key), movvizId: `${found.series.id}:s${found.season.seasonNumber}e${found.episode.episodeNumber}`, seriesId: found.series.id, technical: technical(found.episode.file), lastPlayedAt: d.lastViewedAt ?? d.updatedAt ?? 0 });
  }
  return items.sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);
}
