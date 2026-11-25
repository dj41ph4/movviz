import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { resolvePlayTarget } from "@/lib/ai/playTarget";
import type { AiPlayTarget } from "@/lib/ai/types";

export interface ConnectQueueItem {
  /** Clé de lecture (Plex, sinon l'identité Movviz). */
  ratingKey: string;
  /** Identifiant Movviz du fichier local (la série pour un épisode, le film), null si seul Plex l'a. */
  localKey: string | null;
  /** -1 pour un film. */
  season: number;
  episode: number;
  label: string;
}

export interface ConnectPlayResolution {
  target: AiPlayTarget;
  /** Où reprendre (secondes) : absent = depuis le début. */
  resumeSeconds?: number;
  /** File de lecture des apps natives : le film, ou tous les épisodes lisibles (le suivant s'enchaîne). */
  queue: ConnectQueueItem[];
  startIndex: number;
}

function buildQueue(target: AiPlayTarget): { queue: ConnectQueueItem[]; startIndex: number } {
  if (target.type === "movie") {
    const movie = getMovieByTmdbId(target.tmdbId);
    return { queue: [{ ratingKey: target.ratingKey, localKey: movie?.file ? movie.id : null, season: -1, episode: -1, label: target.title }], startIndex: 0 };
  }
  const series = getSeriesByTmdbId(target.tmdbId);
  if (!series) return { queue: [], startIndex: 0 };
  const queue: ConnectQueueItem[] = [];
  const seasons = [...series.seasons].filter((x) => x.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const season of seasons) {
    for (const ep of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      if (!ep.file && !ep.plexRatingKey) continue;
      queue.push({
        ratingKey: ep.plexRatingKey ?? `${series.id}:s${season.seasonNumber}e${ep.episodeNumber}`,
        localKey: ep.file ? series.id : null,
        season: season.seasonNumber,
        episode: ep.episodeNumber,
        label: `S${season.seasonNumber} · Ép ${ep.episodeNumber}${ep.title ? ` · ${ep.title}` : ""}`,
      });
    }
  }
  const startIndex = queue.findIndex((q) => q.season === target.seasonNumber && q.episode === target.episodeNumber);
  if (startIndex >= 0) return { queue, startIndex };
  // Épisode demandé hors de la file (spécial de la saison 0…) : il est lu seul, avec SA source.
  const season = series.seasons.find((x) => x.seasonNumber === target.seasonNumber);
  const ep = season?.episodes.find((e) => e.episodeNumber === target.episodeNumber);
  if (!ep) return { queue, startIndex: 0 };
  return {
    queue: [{
      ratingKey: target.ratingKey,
      localKey: ep.file ? series.id : null,
      season: target.seasonNumber ?? 0,
      episode: target.episodeNumber ?? 0,
      label: `S${target.seasonNumber} · Ép ${target.episodeNumber}${ep.title ? ` · ${ep.title}` : ""}`,
    }],
    startIndex: 0,
  };
}

/**
 * Ce qu'un appareil récepteur doit lire pour un ordre « lire » : le fichier
 * (Movviz d'abord, Plex sinon), l'épisode demandé — ou, sans épisode précis,
 * celui où l'utilisateur en était — et la position de reprise.
 * Null quand le titre n'est pas lisible depuis la bibliothèque.
 */
export function resolveConnectPlay(
  userId: string,
  req: { tmdbId: number; mediaType: "movie" | "series"; season?: number; episode?: number; fromBeginning?: boolean; resumeSeconds?: number },
): ConnectPlayResolution | null {
  let target: AiPlayTarget | null = null;
  if (req.mediaType === "series" && req.season !== undefined && req.episode !== undefined) {
    const series = getSeriesByTmdbId(req.tmdbId);
    const ep = series?.seasons.find((s) => s.seasonNumber === req.season)?.episodes.find((e) => e.episodeNumber === req.episode);
    if (series && ep && (ep.file || ep.plexRatingKey)) {
      const movvizId = `${series.id}:s${req.season}e${req.episode}`;
      target = {
        type: "series", tmdbId: series.tmdbId, title: series.title, posterPath: series.posterPath,
        ratingKey: ep.plexRatingKey ?? movvizId, movvizId, seriesId: series.id,
        seasonNumber: req.season, episodeNumber: req.episode, episodeTitle: ep.title || undefined,
      };
    }
  } else if (req.mediaType === "movie") {
    const movie = getMovieByTmdbId(req.tmdbId);
    if (movie && (movie.file || movie.plexRatingKey)) target = resolvePlayTarget(userId, { tmdbId: req.tmdbId, type: "movie" });
  } else {
    target = resolvePlayTarget(userId, { tmdbId: req.tmdbId, type: "series" });
  }
  if (!target) return null;
  const q = buildQueue(target);
  if (req.fromBeginning) return { target, ...q };
  // Une position nulle vaut « depuis le début » (personne devant la TV pour répondre à « reprendre ? »).
  if (req.resumeSeconds !== undefined) return req.resumeSeconds >= 1 ? { target, resumeSeconds: Math.min(req.resumeSeconds, 1_000_000), ...q } : { target, ...q };
  const saved = listPlaybackProgress(userId).find(
    (p) =>
      p.tmdbId === target.tmdbId &&
      (target.type === "movie"
        ? p.mediaType === "movie"
        : p.mediaType === "episode" && p.seasonNumber === target.seasonNumber && p.episodeNumber === target.episodeNumber),
  );
  const resume = saved?.resumeOffsetMs ? Math.round(saved.resumeOffsetMs / 1000) : 0;
  return resume > 0 ? { target, resumeSeconds: resume, ...q } : { target, ...q };
}
