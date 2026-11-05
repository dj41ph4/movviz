import { getSeries, getSeason } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/metadata/resolveTitle";
import { setWatchedMovies, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { pushMovieWatchedToPlex, pushEpisodesWatchedToPlex } from "@/lib/plex/watchWrite";
import type { User } from "@/lib/auth/types";

/**
 * LifeHub → Movviz (demande explicite user) — same contract as the Netflix
 * import (src/lib/netflix/importHistory.ts): strictly per-user, written into
 * the same watched-status store Plex sync feeds, pushed onward to the user's
 * own Plex when linked. Unlike Netflix there is no fuzzy title matching: a
 * LifeHub export already carries each title's TMDb id.
 *
 * Mapping:
 *  - movie + "vu"                      → watched movie
 *  - tv + "vu"                         → every episode of every regular season
 *  - tv + "en_cours" (season, episode) → every episode strictly BEFORE the
 *    one LifeHub says the user is currently on (that one is not finished yet)
 */

const CONCURRENCY = 4;
const MAX_UNMATCHED = 100;

export interface LifehubImportResult {
  totalRows: number;
  moviesMatched: number;
  episodesMatched: number;
  unmatched: string[];
}

export type LifehubImportProgress = (current: number, total: number) => void;

interface LifehubTitle {
  title: string;
  media_type: string;
  status: string;
  tmdb_id: number;
  current_season: number | null;
  current_episode: number | null;
  updated_at: string | null;
}

function parseTitles(json: string): LifehubTitle[] {
  const data = JSON.parse(json) as { source?: string; titres?: unknown };
  if (!data || !Array.isArray(data.titres)) throw new Error("Fichier LifeHub invalide (liste « titres » absente)");
  const out: LifehubTitle[] = [];
  for (const raw of data.titres as Record<string, unknown>[]) {
    const tmdbId = Number(raw?.tmdb_id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
    const mediaType = String(raw.media_type ?? "");
    if (mediaType !== "movie" && mediaType !== "tv") continue;
    out.push({
      title: String(raw.title ?? tmdbId),
      media_type: mediaType,
      status: String(raw.status ?? ""),
      tmdb_id: tmdbId,
      current_season: Number.isFinite(Number(raw.current_season)) && raw.current_season != null ? Number(raw.current_season) : null,
      current_episode: Number.isFinite(Number(raw.current_episode)) && raw.current_episode != null ? Number(raw.current_episode) : null,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    });
  }
  return out;
}

function toTimestamp(s: string | null): number | null {
  if (!s) return null;
  // "2026-07-04 12:31:14.311747+00" → ISO-compatible
  const t = Date.parse(s.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isFinite(t) ? t : null;
}

export async function importLifehubHistory(user: User, json: string, onProgress?: LifehubImportProgress): Promise<LifehubImportResult> {
  const titles = parseTitles(json);
  const movies = titles.filter((t) => t.media_type === "movie" && t.status === "vu");
  const shows = titles.filter((t) => t.media_type === "tv" && (t.status === "vu" || t.status === "en_cours"));
  const unmatched: string[] = [];

  let done = 0;
  let total = shows.length;
  const tick = () => onProgress?.(++done, total);
  onProgress?.(0, Math.max(1, total));

  type Entry = { tmdbId: number; season: number; episode: number; watchedAt: number | null };
  const perShow: { title: string; tmdbId: number; entries: Entry[] }[] = [];

  await mapWithConcurrency(shows, CONCURRENCY, async (show) => {
    try {
      const series = await getSeries(show.tmdb_id);
      if (!series) { unmatched.push(show.title); return; }
      const watchedAt = toTimestamp(show.updated_at);
      const seasons = (series.seasons ?? []).filter((s) => s.seasonNumber >= 1);
      const entries: Entry[] = [];
      for (const s of seasons) {
        // "en cours": nothing to fetch for seasons after the current one.
        if (show.status === "en_cours") {
          if (show.current_season == null || s.seasonNumber > show.current_season) continue;
        }
        let eps: { seasonNumber: number; episodeNumber: number }[];
        if (show.status === "en_cours" && s.seasonNumber === show.current_season) {
          eps = Array.from({ length: Math.max(0, (show.current_episode ?? 1) - 1) }, (_, i) => ({ seasonNumber: s.seasonNumber, episodeNumber: i + 1 }));
        } else {
          const data = await getSeason(show.tmdb_id, s.seasonNumber).catch(() => null);
          eps = data?.episodes ?? [];
        }
        for (const ep of eps) entries.push({ tmdbId: show.tmdb_id, season: ep.seasonNumber, episode: ep.episodeNumber, watchedAt });
      }
      if (entries.length) perShow.push({ title: series.title || show.title, tmdbId: show.tmdb_id, entries });
      else if (show.status === "vu") unmatched.push(show.title);
    } finally {
      tick();
    }
  });

  let episodesMatched = 0;
  for (const s of perShow) {
    setWatchedEpisodes(user.id, s.entries, true, s.title, "external_import");
    pushEpisodesWatchedToPlex(user, s.entries, true).catch(() => {});
    episodesMatched += s.entries.length;
  }
  for (const m of movies) {
    setWatchedMovies(user.id, [m.tmdb_id], true, m.title, toTimestamp(m.updated_at), "external_import");
    pushMovieWatchedToPlex(user, m.tmdb_id, true).catch(() => {});
  }

  return {
    totalRows: titles.length,
    moviesMatched: movies.length,
    episodesMatched,
    unmatched: unmatched.slice(0, MAX_UNMATCHED),
  };
}
