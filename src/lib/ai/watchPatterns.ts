import { withUserContextDb } from "@/lib/userContext/database";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";

/**
 * Habitudes de visionnage tirées du registre des événements (déterministe, aucun appel au modèle) :
 * ce qui a été REVU, et ce qui a été entamé puis laissé. Un titre vu plusieurs fois est un signal
 * de goût durable bien plus fort qu'un visionnage unique — l'IA doit le savoir.
 *
 * Un « visionnage » = un événement de fin de lecture, deux événements du même épisode ou film
 * séparés d'au moins 12 h comptant pour deux visionnages (le même passage peut être enregistré par
 * plusieurs sources à quelques minutes d'écart : un seul visionnage).
 */
const SEPARATE_VIEWING_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Une série à ce niveau d'épisodes vus (hors spéciaux, déjà diffusés) est « vue en entier ». */
const FULLY_SEEN_RATIO = 0.9;
const MAX_LINES = 10;

interface CompletedRow {
  tmdb_id: number;
  media_type: string | null;
  season_number: number | null;
  episode_number: number | null;
  title_snapshot: string | null;
  occurred_at: number;
}

export interface WatchPatterns {
  rewatchedMovies: { tmdbId: number; title: string; viewings: number; firstAt: number; lastAt: number }[];
  rewatchedSeries: { tmdbId: number; title: string; episodesSeen: number; episodesTotal: number | null; episodesRewatched: number; maxViewings: number; firstAt: number; lastAt: number; fullySeen: boolean }[];
  /** Séries entamées (quelques épisodes vus dans Movviz) puis non poursuivies depuis longtemps. */
  dropped: { tmdbId: number; title: string; episodesSeen: number; lastAt: number }[];
}

/** Nombre de visionnages distincts à partir des dates d'événements d'un même élément. */
export function countViewings(timestamps: number[]): { viewings: number; firstAt: number; lastAt: number } {
  const sorted = [...timestamps].sort((a, b) => a - b);
  let viewings = 0;
  let last = Number.NEGATIVE_INFINITY;
  for (const t of sorted) {
    if (t - last >= SEPARATE_VIEWING_MS) viewings++;
    last = t;
  }
  return { viewings, firstAt: sorted[0] ?? 0, lastAt: sorted[sorted.length - 1] ?? 0 };
}

function airedEpisodeCount(tmdbId: number): number | null {
  const series = getSeriesByTmdbId(tmdbId);
  if (!series) return null;
  const now = Date.now();
  let total = 0;
  for (const season of series.seasons) {
    if (season.seasonNumber === 0) continue;
    for (const ep of season.episodes) {
      const aired = ep.airDate ? Date.parse(ep.airDate) : Number.NaN;
      if (!Number.isNaN(aired) && aired <= now) total++;
    }
  }
  return total > 0 ? total : null;
}

export function computeWatchPatterns(userId: string, now = Date.now()): WatchPatterns {
  const rows = withUserContextDb((db) => db.prepare(`
    SELECT tmdb_id, media_type, season_number, episode_number, title_snapshot, occurred_at
    FROM context_events
    WHERE user_id = ?
      AND tmdb_id IS NOT NULL
      AND event_type IN ('movie_completed', 'episode_completed', 'watched_marked')
    ORDER BY occurred_at ASC
    LIMIT 20000
  `).all(userId) as unknown as CompletedRow[], [] as CompletedRow[]);

  const titles = new Map<string, string>();
  const movies = new Map<number, number[]>();
  const episodes = new Map<string, { tmdbId: number; times: number[] }>();
  for (const row of rows) {
    if (!Number.isFinite(row.tmdb_id) || !Number.isFinite(row.occurred_at)) continue;
    const tmdbId = Number(row.tmdb_id);
    if (row.media_type === "movie") {
      movies.set(tmdbId, [...(movies.get(tmdbId) ?? []), row.occurred_at]);
      if (row.title_snapshot?.trim()) titles.set(`movie:${tmdbId}`, row.title_snapshot.trim());
    } else if (row.season_number != null && row.episode_number != null) {
      const key = `${tmdbId}:${row.season_number}:${row.episode_number}`;
      const entry = episodes.get(key) ?? { tmdbId, times: [] };
      entry.times.push(row.occurred_at);
      episodes.set(key, entry);
      if (row.title_snapshot?.trim()) titles.set(`series:${tmdbId}`, row.title_snapshot.trim().replace(/\s+[—-]\s+\d+x\d+.*$/, ""));
    }
  }

  const patterns: WatchPatterns = { rewatchedMovies: [], rewatchedSeries: [], dropped: [] };
  for (const [tmdbId, times] of movies) {
    const { viewings, firstAt, lastAt } = countViewings(times);
    if (viewings < 2) continue;
    patterns.rewatchedMovies.push({ tmdbId, title: getMovieByTmdbId(tmdbId)?.title ?? titles.get(`movie:${tmdbId}`) ?? `#${tmdbId}`, viewings, firstAt, lastAt });
  }

  const bySeries = new Map<number, { seen: number; rewatched: number; maxViewings: number; firstAt: number; lastAt: number }>();
  for (const { tmdbId, times } of episodes.values()) {
    const { viewings, firstAt, lastAt } = countViewings(times);
    const agg = bySeries.get(tmdbId) ?? { seen: 0, rewatched: 0, maxViewings: 0, firstAt: Number.POSITIVE_INFINITY, lastAt: 0 };
    agg.seen++;
    if (viewings >= 2) agg.rewatched++;
    agg.maxViewings = Math.max(agg.maxViewings, viewings);
    agg.firstAt = Math.min(agg.firstAt, firstAt);
    agg.lastAt = Math.max(agg.lastAt, lastAt);
    bySeries.set(tmdbId, agg);
  }
  for (const [tmdbId, agg] of bySeries) {
    const title = getSeriesByTmdbId(tmdbId)?.title ?? titles.get(`series:${tmdbId}`) ?? `#${tmdbId}`;
    const total = airedEpisodeCount(tmdbId);
    const fullySeen = total != null && agg.seen / total >= FULLY_SEEN_RATIO;
    if (agg.rewatched > 0) {
      patterns.rewatchedSeries.push({ tmdbId, title, episodesSeen: agg.seen, episodesTotal: total, episodesRewatched: agg.rewatched, maxViewings: agg.maxViewings, firstAt: agg.firstAt, lastAt: agg.lastAt, fullySeen });
    } else if (agg.seen <= 2 && !fullySeen && now - agg.lastAt > 60 * DAY_MS) {
      patterns.dropped.push({ tmdbId, title, episodesSeen: agg.seen, lastAt: agg.lastAt });
    }
  }

  patterns.rewatchedMovies.sort((a, b) => b.viewings - a.viewings || b.lastAt - a.lastAt);
  patterns.rewatchedSeries.sort((a, b) => b.episodesRewatched - a.episodesRewatched || b.lastAt - a.lastAt);
  patterns.dropped.sort((a, b) => b.lastAt - a.lastAt);
  return patterns;
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Lignes prêtes à insérer dans une demande au modèle ; vide quand il n'y a rien à dire. */
export function formatWatchPatterns(patterns: WatchPatterns): string[] {
  const lines: string[] = [];
  for (const s of patterns.rewatchedSeries.slice(0, 6)) {
    const seen = s.episodesTotal ? `${s.episodesSeen}/${s.episodesTotal} épisodes vus` : `${s.episodesSeen} épisodes vus`;
    lines.push(`${s.title} (série${s.fullySeen ? ", vue en entier" : ""}) : REVUE — ${s.episodesRewatched} épisode(s) revu(s) sur ${seen}${s.maxViewings > 2 ? `, jusqu'à ${s.maxViewings} fois le même` : ""}, premier visionnage ${day(s.firstAt)}, dernier ${day(s.lastAt)}`);
  }
  for (const m of patterns.rewatchedMovies.slice(0, 6)) {
    lines.push(`${m.title} (film) : REVU — ${m.viewings} visionnages, le premier ${day(m.firstAt)}, le dernier ${day(m.lastAt)}`);
  }
  return lines.slice(0, MAX_LINES);
}

/** Séries entamées puis laissées, avec la précaution qui s'impose : Movviz ne voit que ce qui est passé par lui. */
export function formatDroppedSeries(patterns: WatchPatterns, now = Date.now()): string[] {
  return patterns.dropped.slice(0, 6).map((s) => `${s.title} : ${s.episodesSeen} épisode(s) vu(s) dans Movviz, plus rien depuis ${Math.round((now - s.lastAt) / DAY_MS)} jours`);
}
